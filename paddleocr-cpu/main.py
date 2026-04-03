"""PaddleOCR-VL 1.5 CPU wrapper — exposes the same /ocr and /health API
as the official GPU Docker image so the backend doesn't need to change.

Performance: ~30-60s per page on CPU. Fine for dev/testing, not production.
On scan stations, replace this with the official GPU image.
"""

import io
import logging
import time
import tempfile
import os

from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="PaddleOCR-VL CPU")

# Lazy-load the model on first request to speed up container startup
_pipeline = None


def get_pipeline():
    """Load PaddleOCR-VL pipeline on first use."""
    global _pipeline
    if _pipeline is None:
        logger.info("Loading PaddleOCR-VL model (CPU mode)... this may take a minute")
        start = time.time()
        from paddleocr import PaddleOCRVL
        _pipeline = PaddleOCRVL(device="cpu")
        elapsed = time.time() - start
        logger.info("Model loaded in %.1f seconds", elapsed)
    return _pipeline


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

            # Build response matching the official PaddleOCR-VL API format
            pages = []
            for i, page_result in enumerate(result):
                # PaddleOCR-VL returns a dict with 'rec_texts' and other info
                # The predict method returns structured results per page
                markdown = _result_to_markdown(page_result, i)
                pages.append({
                    "pageId": i,
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


def _result_to_markdown(page_result: dict, page_index: int) -> str:
    """Convert PaddleOCR-VL prediction result to markdown string.

    The PaddleOCR-VL pipeline returns different structures depending on
    the input. We handle the common cases and fall back to string conversion.
    """
    # If result is already a string (markdown output from doc parser)
    if isinstance(page_result, str):
        return page_result

    # If result is a dict with 'markdown' key
    if isinstance(page_result, dict):
        if "markdown" in page_result:
            return page_result["markdown"]
        if "rec_texts" in page_result:
            return "\n".join(page_result["rec_texts"])
        if "text" in page_result:
            return page_result["text"]

    # If result is a list of text items
    if isinstance(page_result, (list, tuple)):
        lines = []
        for item in page_result:
            if isinstance(item, str):
                lines.append(item)
            elif isinstance(item, dict):
                text = item.get("text", item.get("rec_text", str(item)))
                lines.append(text)
            else:
                lines.append(str(item))
        return "\n".join(lines)

    return str(page_result)


@app.get("/health")
async def health():
    """Health check — reports model status."""
    return {
        "status": "healthy",
        "model": "PaddleOCR-VL-1.5",
        "device": "cpu",
        "model_loaded": _pipeline is not None,
    }
