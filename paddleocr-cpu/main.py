"""PaddleOCR-VL 1.5 CPU wrapper — exposes the same /ocr and /health API
as the official GPU Docker image so the backend doesn't need to change.

Performance: ~30-60s per page on CPU. Fine for dev/testing, not production.
On scan stations, replace this with the official GPU image.
"""

import json
import logging
import time
import tempfile
import os

from fastapi import FastAPI, File, UploadFile, HTTPException

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PaddleOCR-VL CPU")

_pipeline = None


def get_pipeline():
    """Return the loaded pipeline (loaded at startup)."""
    global _pipeline
    if _pipeline is None:
        _load_model()
    return _pipeline


def _load_model():
    """Load PaddleOCR-VL model into memory."""
    global _pipeline
    logger.info("Loading PaddleOCR-VL model (CPU mode)... this may take a minute")
    start = time.time()
    from paddleocr import PaddleOCRVL
    _pipeline = PaddleOCRVL(device="cpu")
    elapsed = time.time() - start
    logger.info("Model loaded in %.1f seconds", elapsed)


@app.on_event("startup")
async def startup():
    """Pre-load the model so first request is fast."""
    _load_model()


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    """OCR endpoint matching the PaddleOCR-VL Docker API response format.

    Accepts image or PDF files, returns structured markdown per page.
    """
    contents = await file.read()
    filename = file.filename or "upload.pdf"

    logger.info("OCR request: %s (%d bytes)", filename, len(contents))
    start = time.time()

    try:
        pipeline = get_pipeline()

        # Write to temp file — PaddleOCR-VL expects a file path
        suffix = os.path.splitext(filename)[1] or ".pdf"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            result = pipeline.predict(tmp_path)

            # PaddleOCR-VL predict() returns a generator of Result objects
            # (NOT plain dicts). Each Result has properties:
            #   .markdown  — dict or str with the page markdown content
            #   .json      — dict with full structured data under "res" key
            #   .img       — dict with visualization images
            # And methods: .print(), .save_to_json(), .save_to_markdown()
            pages = []
            for res_obj in result:
                page_idx = len(pages)
                res_type = type(res_obj).__name__

                logger.info(
                    "Page %d result type: %s",
                    page_idx,
                    res_type,
                )

                markdown = _extract_markdown_from_result(res_obj)
                layout_elements = _extract_layout_elements(res_obj)

                logger.info(
                    "Page %d extracted markdown (%d chars): %s",
                    page_idx,
                    len(markdown),
                    markdown[:500],
                )

                pages.append({
                    "pageId": page_idx,
                    "markdown": markdown,
                    "layoutElements": layout_elements,
                })

        finally:
            os.unlink(tmp_path)

        elapsed = time.time() - start
        logger.info("OCR complete: %d pages in %.1fs", len(pages), elapsed)

        return {
            "errorCode": 0,
            "errorMsg": "Success",
            "result": {
                "pages": pages,
            },
        }

    except Exception as e:
        logger.error("OCR error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _extract_markdown_from_result(res_obj) -> str:
    """Extract markdown text from a PaddleOCR-VL Result object.

    PaddleOCR-VL predict() yields Result objects with:
      - .markdown property (dict with markdown content, or str)
      - .save_to_markdown(path) method that writes .md files
      - .json property with full structured result under "res" key
    If the object is a plain dict (older API), fall back to key lookup.
    """

    # --- Strategy 1: Result object .markdown property ---
    try:
        md = res_obj.markdown
        if isinstance(md, str) and md.strip():
            return md.strip()
        if isinstance(md, dict):
            # The markdown property may return a dict with content
            # Try common keys
            for key in ("markdown", "content", "text"):
                if key in md and isinstance(md[key], str) and md[key].strip():
                    return md[key].strip()
            # If the dict has string values, concatenate them
            parts = [v for v in md.values() if isinstance(v, str) and v.strip()]
            if parts:
                return "\n\n".join(parts)
    except Exception as e:
        logger.debug("Result.markdown access failed: %s", e)

    # --- Strategy 2: save_to_markdown to temp dir and read the file ---
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            res_obj.save_to_markdown(save_path=tmpdir)
            # Walk the temp dir for .md files
            for root, dirs, files in os.walk(tmpdir):
                for fname in files:
                    if fname.endswith(".md"):
                        fpath = os.path.join(root, fname)
                        with open(fpath, "r", encoding="utf-8") as f:
                            content = f.read().strip()
                        if content:
                            return content
    except Exception as e:
        logger.debug("save_to_markdown failed: %s", e)

    # --- Strategy 3: Result object .json property → rec_texts ---
    try:
        j = res_obj.json
        if isinstance(j, dict):
            res_data = j.get("res", j)
            # rec_texts: list of recognized text strings
            rec_texts = res_data.get("rec_texts", [])
            if rec_texts:
                return "\n".join(str(t) for t in rec_texts)
    except Exception as e:
        logger.debug("Result.json access failed: %s", e)

    # --- Strategy 4: Plain dict fallback (older API versions) ---
    if isinstance(res_obj, dict):
        return _extract_markdown_from_dict(res_obj)

    # --- Strategy 5: str() fallback ---
    try:
        s = str(res_obj)
        if s and len(s) > 10:
            return s
    except Exception:
        pass

    return ""


def _extract_markdown_from_dict(page_result: dict) -> str:
    """Fallback: extract markdown from a plain dict (older PaddleOCR versions)."""
    for key in ("markdown", "text", "content"):
        if key in page_result and isinstance(page_result[key], str):
            return page_result[key]

    if "rec_texts" in page_result:
        texts = page_result["rec_texts"]
        if isinstance(texts, list):
            return "\n".join(str(t) for t in texts)

    if "layout_parsing_res" in page_result:
        lp = page_result["layout_parsing_res"]
        if isinstance(lp, dict):
            for key in ("markdown", "text"):
                if key in lp:
                    return lp[key]

    # Walk string values
    best = ""
    for v in page_result.values():
        if isinstance(v, str) and len(v) > len(best):
            best = v
        elif isinstance(v, dict):
            for v2 in v.values():
                if isinstance(v2, str) and len(v2) > len(best):
                    best = v2
    return best


def _extract_layout_elements(res_obj) -> list:
    """Extract layout bounding boxes from a Result object for UI overlay."""
    elements = []
    try:
        j = res_obj.json if not isinstance(res_obj, dict) else res_obj
        if isinstance(j, dict):
            res_data = j.get("res", j)
            layout = res_data.get("layout_det_res", {})
            boxes = layout.get("boxes", []) if isinstance(layout, dict) else []
            for box in boxes:
                if isinstance(box, dict):
                    coord = box.get("coordinate", [])
                    # Convert numpy floats to plain floats
                    coord = [float(c) for c in coord] if coord else []
                    elements.append({
                        "bbox": coord,
                        "category": box.get("label", "unknown"),
                        "score": float(box.get("score", 0)),
                    })
    except Exception as e:
        logger.debug("Layout extraction failed: %s", e)
    return elements


@app.get("/health")
async def health():
    """Health check — reports model status."""
    return {
        "status": "healthy",
        "model": "PaddleOCR-VL-1.5",
        "device": "cpu",
        "model_loaded": _pipeline is not None,
    }
