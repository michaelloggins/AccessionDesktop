"""Client for the local PaddleOCR-VL service.

Sends scanned images to the OCR container and parses the Markdown response
into structured accession fields.
"""

import base64
import json
import logging
import os
import re
from typing import Optional

import httpx

from app.core.config import settings
from app.models.accession import (
    OcrExtraction,
    OrderingInfo,
    Patient,
    Specimen,
    TestOrder,
)

logger = logging.getLogger(__name__)


async def extract_from_image(image_bytes: bytes, filename: str) -> OcrExtraction:
    """Send an image to PaddleOCR-VL and return structured extraction.

    Two-step process:
      1. Call /ocr endpoint → get raw Markdown
      2. Parse Markdown into accession fields (heuristic + prompt-based)
    """
    timeout_secs = settings.ocr_timeout_ms / 1000.0
    # Explicit timeout: short connect, long read (CPU inference is slow)
    timeout = httpx.Timeout(connect=30.0, read=timeout_secs, write=30.0, pool=timeout_secs)

    async with httpx.AsyncClient(timeout=timeout) as client:
        # Step 1: Send image to OCR
        response = await client.post(
            f"{settings.ocr_api_url}/ocr",
            files={"file": (filename, image_bytes)},
        )
        response.raise_for_status()
        ocr_result = response.json()

    # Extract markdown from response
    raw_markdown = _extract_markdown(ocr_result)

    # Step 2: Parse markdown into structured fields
    extraction = _parse_markdown_to_fields(raw_markdown)
    extraction.raw_markdown = raw_markdown

    logger.info("OCR extraction complete — confidence=%.2f", extraction.confidence)
    logger.debug("Raw OCR markdown:\n%s", raw_markdown[:2000])
    logger.debug(
        "Parsed fields: patient=%s, physician=%s, specimen=%s, tests=%d",
        extraction.patient.name,
        extraction.ordering.physician,
        extraction.specimen.type,
        len(extraction.tests),
    )
    return extraction


def _extract_markdown(ocr_result: dict) -> str:
    """Pull the markdown text from the PaddleOCR-VL response format."""
    # PaddleOCR-VL response: {"result": {"pages": [{"markdown": "..."}]}}
    try:
        pages = ocr_result.get("result", {}).get("pages", [])
        return "\n\n".join(page.get("markdown", "") for page in pages)
    except (KeyError, TypeError):
        # Fallback: maybe it's a simpler response format
        return ocr_result.get("markdown", str(ocr_result))


def _parse_markdown_to_fields(markdown: str) -> OcrExtraction:
    """Parse OCR markdown into structured accession fields.

    This is the heuristic parser for known requisition form layouts.
    It looks for common field labels in the markdown tables and text.

    For MVP, this handles the most common patterns. As we collect more
    sample forms, we can refine the parsing or add VLM-based extraction.
    """
    fields = _extract_key_value_pairs(markdown)

    patient = Patient(
        name=fields.get("patient_name", fields.get("patient", "")),
        dob=fields.get("dob", fields.get("date_of_birth", None)),
        mrn=fields.get("mrn", fields.get("medical_record", None)),
        species=fields.get("species", None),
        breed=fields.get("breed", None),
        owner_name=fields.get("owner", fields.get("owner_name", None)),
    )

    ordering = OrderingInfo(
        physician=fields.get("physician", fields.get("ordering_physician", None)),
        npi=fields.get("npi", None),
    )

    specimen = Specimen(
        type=fields.get("specimen_type", fields.get("specimen", None)),
        collection_date=fields.get("collection_date", None),
    )

    tests = _extract_tests(markdown, fields)

    # Confidence: rough heuristic based on how many key fields we found
    key_fields = [patient.name, ordering.physician, specimen.type]
    filled = sum(1 for f in key_fields if f)
    confidence = filled / len(key_fields)

    return OcrExtraction(
        patient=patient,
        ordering=ordering,
        specimen=specimen,
        tests=tests,
        priority=fields.get("priority", "Routine"),
        diagnosis_codes=_extract_diagnosis_codes(markdown),
        confidence=confidence,
    )


def _extract_key_value_pairs(markdown: str) -> dict[str, str]:
    """Extract key-value pairs from markdown tables and labeled lines.

    Handles patterns like:
      | Patient Name | John Doe |
      Patient Name: John Doe
      **Patient Name:** John Doe
    """
    pairs: dict[str, str] = {}

    # Table rows: | Key | Value |
    table_pattern = re.compile(r"\|\s*(.+?)\s*\|\s*(.+?)\s*\|")
    for match in table_pattern.finditer(markdown):
        key = match.group(1).strip().lower()
        value = match.group(2).strip()
        # Skip header separator rows
        if not key.startswith("-") and value and not value.startswith("-"):
            normalized = _normalize_key(key)
            if normalized:
                pairs[normalized] = value

    # Label: Value or **Label:** Value
    label_pattern = re.compile(r"(?:\*\*)?([A-Za-z\s/]+?)(?:\*\*)?:\s*(.+)")
    for match in label_pattern.finditer(markdown):
        key = match.group(1).strip().lower()
        value = match.group(2).strip()
        normalized = _normalize_key(key)
        if normalized and normalized not in pairs:
            pairs[normalized] = value

    return pairs


def _normalize_key(key: str) -> Optional[str]:
    """Map common field label variations to canonical names."""
    key = key.lower().strip("*: ")
    mappings = {
        "patient name": "patient_name",
        "patient": "patient_name",
        "name": "patient_name",
        "date of birth": "dob",
        "dob": "dob",
        "birth date": "dob",
        "mrn": "mrn",
        "medical record": "mrn",
        "medical record number": "mrn",
        "physician": "physician",
        "ordering physician": "ordering_physician",
        "doctor": "physician",
        "npi": "npi",
        "specimen type": "specimen_type",
        "specimen": "specimen_type",
        "sample type": "specimen_type",
        "collection date": "collection_date",
        "collected": "collection_date",
        "priority": "priority",
        "species": "species",
        "breed": "breed",
        "owner": "owner_name",
        "owner name": "owner_name",
        "pet owner": "owner_name",
    }
    return mappings.get(key)


def _extract_tests(markdown: str, fields: dict) -> list[TestOrder]:
    """Extract test orders from the markdown.

    Loads the local test menu for code matching.
    """
    tests = []
    test_menu = _load_test_menu()

    # Look for test names in the markdown that match our menu
    markdown_lower = markdown.lower()
    for test in test_menu:
        if test["name"].lower() in markdown_lower or test["code"].lower() in markdown_lower:
            tests.append(TestOrder(code=test["code"], name=test["name"]))

    return tests


def _extract_diagnosis_codes(markdown: str) -> list[str]:
    """Find ICD-10 codes in the markdown."""
    icd_pattern = re.compile(r"\b[A-Z]\d{2}(?:\.\d{1,4})?\b")
    return list(set(icd_pattern.findall(markdown)))


def _load_test_menu() -> list[dict]:
    """Load the test menu from the synced config repo."""
    path = os.path.join(settings.config_path, "reference", "test_menu.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("Test menu not found at %s", path)
        return []
