"""Scan and OCR endpoints — handles both TWAIN capture and file upload."""

import logging

from fastapi import APIRouter, File, UploadFile

from app.models.accession import OcrExtraction
from app.services.ocr_client import extract_from_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("/upload", response_model=OcrExtraction)
async def upload_document(file: UploadFile = File(...)):
    """Upload a scanned document (image or PDF) for OCR extraction.

    Accepts: PNG, JPEG, TIFF, PDF
    Returns: Structured extraction with confidence score
    """
    contents = await file.read()
    logger.info("Document uploaded: %s (%d bytes)", file.filename, len(contents))

    extraction = await extract_from_image(contents, file.filename or "upload.pdf")
    return extraction


@router.post("/capture", response_model=OcrExtraction)
async def capture_from_scanner():
    """Trigger TWAIN scanner capture and run OCR.

    This endpoint initiates a scan from the connected TWAIN scanner,
    captures the image, and runs OCR extraction.

    Note: TWAIN is a Windows-only protocol. This endpoint will return
    an error if no scanner is available (e.g., in Docker containers).
    The frontend should fall back to upload in that case.
    """
    # TWAIN integration is a future enhancement.
    # For now, operators use the upload endpoint.
    # When TWAIN is ready, this will:
    #   1. Call the TWAIN driver to capture an image
    #   2. Pass the image bytes to extract_from_image()
    #   3. Return the extraction
    from fastapi import HTTPException
    raise HTTPException(
        status_code=501,
        detail="TWAIN capture not yet implemented. Use /api/scan/upload instead.",
    )
