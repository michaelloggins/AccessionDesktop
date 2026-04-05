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

            # PaddleOCR-VL predict() returns a generator of page result dicts.
            # Each dict has keys like: input_path, page_index, page_count,
            # doc_preprocessor_res, layout_det_res, and the actual content.
            # We need to find the markdown text in the nested structure.
            pages = []
            for page_result in result:
                page_idx = len(pages)

                # Log the structure for debugging
                if isinstance(page_result, dict):
                    # Filter out numpy arrays for logging
                    safe_keys = {
                        k: type(v).__name__
                        for k, v in page_result.items()
                    }
                    logger.info("Page %d keys: %s", page_idx, safe_keys)

                    # Try to find the markdown/text content
                    markdown = _extract_markdown_from_result(page_result)
                    logger.info(
                        "Page %d extracted markdown (%d chars): %s",
                        page_idx,
                        len(markdown),
                        markdown[:500],
                    )
                else:
                    logger.info(
                        "Page %d unexpected type: %s",
                        page_idx,
                        type(page_result).__name__,
                    )
                    markdown = str(page_result)

                pages.append({
                    "pageId": page_idx,
                    "markdown": markdown,
                    "layoutElements": [],
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


def _extract_markdown_from_result(page_result: dict) -> str:
    """Extract markdown text from a PaddleOCR-VL page result dict.

    The predict() result structure varies by PaddleOCR version. We try
    multiple known paths to find the actual text content.
    """
    # Direct markdown key
    if "markdown" in page_result:
        return page_result["markdown"]

    # Some versions use 'ocr_vl_res' with markdown inside
    if "ocr_vl_res" in page_result:
        ocr_vl = page_result["ocr_vl_res"]
        if isinstance(ocr_vl, dict) and "markdown" in ocr_vl:
            return ocr_vl["markdown"]
        if isinstance(ocr_vl, str):
            return ocr_vl

    # Try 'text' key
    if "text" in page_result:
        return page_result["text"]

    # Try 'rec_texts' (list of recognized text strings)
    if "rec_texts" in page_result:
        texts = page_result["rec_texts"]
        if isinstance(texts, list):
            return "\n".join(str(t) for t in texts)

    # Try 'layout_parsing_res' which may contain structured text
    if "layout_parsing_res" in page_result:
        lp = page_result["layout_parsing_res"]
        if isinstance(lp, dict):
            if "markdown" in lp:
                return lp["markdown"]
            if "text" in lp:
                return lp["text"]

    # Try extracting from layout_det_res boxes
    if "layout_det_res" in page_result:
        ld = page_result["layout_det_res"]
        if isinstance(ld, dict) and "boxes" in ld:
            texts = []
            for box in ld["boxes"]:
                if isinstance(box, dict):
                    t = box.get("text", box.get("rec_text", ""))
                    if t:
                        texts.append(str(t))
            if texts:
                return "\n".join(texts)

    # Walk all string values in the dict looking for substantial text
    best_text = ""
    for key, value in page_result.items():
        if isinstance(value, str) and len(value) > len(best_text):
            best_text = value
        elif isinstance(value, dict):
            for k2, v2 in value.items():
                if isinstance(v2, str) and len(v2) > len(best_text):
                    best_text = v2

    if best_text:
        return best_text

    # Last resort: dump all non-array keys as JSON for debugging
    safe_dict = {}
    for k, v in page_result.items():
        if not hasattr(v, 'shape'):  # Skip numpy arrays
            try:
                json.dumps(v)
                safe_dict[k] = v
            except (TypeError, ValueError):
                safe_dict[k] = f"<{type(v).__name__}>"

    return json.dumps(safe_dict, indent=2, default=str)


@app.get("/health")
async def health():
    """Health check — reports model status."""
    return {
        "status": "healthy",
        "model": "PaddleOCR-VL-1.5",
        "device": "cpu",
        "model_loaded": _pipeline is not None,
    }
