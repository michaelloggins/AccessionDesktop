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
    """Extract key-value pairs from OCR markdown output.

    Handles multiple formats:
      1. Markdown tables: | Patient Name | John Doe |
      2. Label: Value lines (e.g. "Patient Name: John Doe")
      3. Bold label lines: **Patient Name:** John Doe
      4. Freeform OCR text with known field labels nearby

    Real PaddleOCR output is raw text/markdown — not always clean tables.
    We apply multiple regex strategies and merge results.
    """
    pairs: dict[str, str] = {}

    # --- Strategy 1: Markdown table rows: | Key | Value | ---
    table_pattern = re.compile(r"\|\s*(.+?)\s*\|\s*(.+?)\s*\|")
    for match in table_pattern.finditer(markdown):
        key = match.group(1).strip().lower()
        value = match.group(2).strip()
        # Skip header separator rows and empty values
        if not key.startswith("-") and value and not value.startswith("-"):
            normalized = _normalize_key(key)
            if normalized:
                pairs[normalized] = value

    # --- Strategy 2: "Label: Value" or "**Label:** Value" lines ---
    label_pattern = re.compile(r"(?:\*\*)?([A-Za-z\s/]+?)(?:\*\*)?:\s*(.+)")
    for match in label_pattern.finditer(markdown):
        key = match.group(1).strip().lower()
        value = match.group(2).strip()
        normalized = _normalize_key(key)
        if normalized and normalized not in pairs:
            pairs[normalized] = value

    # --- Strategy 3: Freeform text pattern matching ---
    # For real OCR output that may not have clean label:value structure,
    # look for known patterns in the raw text.
    if not pairs:
        _extract_freeform_fields(markdown, pairs)

    return pairs


def _extract_freeform_fields(text: str, pairs: dict[str, str]) -> None:
    """Extract fields from freeform OCR text using pattern matching.

    Real requisition forms often have fields adjacent to labels without
    clear delimiters. This handles common layouts.
    """
    lines = text.split("\n")

    # Build a map of label -> next-line-or-same-line value
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # Check if this line contains a known label
        lower = stripped.lower()

        # Pattern: "Label    Value" (separated by multiple spaces or tabs)
        multi_space = re.split(r"\s{2,}|\t+", stripped)
        if len(multi_space) >= 2:
            label_part = multi_space[0].strip().lower().rstrip(":")
            value_part = " ".join(multi_space[1:]).strip()
            normalized = _normalize_key(label_part)
            if normalized and value_part and normalized not in pairs:
                pairs[normalized] = value_part
                continue

        # Pattern: label on one line, value on the next
        normalized = _normalize_key(lower.rstrip(":"))
        if normalized and normalized not in pairs:
            # Check next non-empty line for the value
            for j in range(i + 1, min(i + 3, len(lines))):
                next_line = lines[j].strip()
                if next_line and not _normalize_key(next_line.lower().rstrip(":")):
                    pairs[normalized] = next_line
                    break

    # --- Date patterns (collection date, DOB) ---
    date_pattern = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")
    dates = date_pattern.findall(text)
    if dates and "collection_date" not in pairs:
        # Last date is often collection date on vet forms
        pairs.setdefault("collection_date", dates[-1])
    if len(dates) >= 2 and "dob" not in pairs:
        # First date might be DOB
        pairs.setdefault("dob", dates[0])

    # --- NPI pattern ---
    npi_pattern = re.compile(r"\b(\d{10})\b")
    npis = npi_pattern.findall(text)
    if npis and "npi" not in pairs:
        pairs["npi"] = npis[0]

    # --- ICD codes as diagnosis ---
    icd_pattern = re.compile(r"\b([A-Z]\d{2}(?:\.\d{1,4})?)\b")
    codes = icd_pattern.findall(text)
    if codes:
        pairs.setdefault("diagnosis", ", ".join(codes))


def _normalize_key(key: str) -> Optional[str]:
    """Map common field label variations to canonical names.

    Handles both clean mock labels and messy real-OCR labels.
    """
    key = key.lower().strip("*: ").strip()
    # Direct mappings
    mappings = {
        "patient name": "patient_name",
        "patient": "patient_name",
        "name": "patient_name",
        "pet name": "patient_name",
        "animal name": "patient_name",
        "date of birth": "dob",
        "dob": "dob",
        "birth date": "dob",
        "birthdate": "dob",
        "d.o.b": "dob",
        "d.o.b.": "dob",
        "mrn": "mrn",
        "medical record": "mrn",
        "medical record number": "mrn",
        "medical record #": "mrn",
        "record number": "mrn",
        "chart #": "mrn",
        "chart number": "mrn",
        "physician": "physician",
        "ordering physician": "ordering_physician",
        "referring physician": "ordering_physician",
        "doctor": "physician",
        "dr": "physician",
        "clinician": "physician",
        "veterinarian": "physician",
        "attending": "physician",
        "npi": "npi",
        "npi #": "npi",
        "npi number": "npi",
        "specimen type": "specimen_type",
        "specimen": "specimen_type",
        "sample type": "specimen_type",
        "sample": "specimen_type",
        "source": "specimen_type",
        "collection date": "collection_date",
        "collected": "collection_date",
        "date collected": "collection_date",
        "collection dt": "collection_date",
        "date of collection": "collection_date",
        "priority": "priority",
        "stat": "priority",
        "species": "species",
        "breed": "breed",
        "owner": "owner_name",
        "owner name": "owner_name",
        "pet owner": "owner_name",
        "client": "owner_name",
        "client name": "owner_name",
        "facility": "facility",
        "clinic": "facility",
        "hospital": "facility",
        "practice": "facility",
        "facility name": "facility",
        "clinic name": "facility",
        "tests ordered": "tests_ordered",
        "test": "tests_ordered",
        "tests": "tests_ordered",
        "test ordered": "tests_ordered",
        "diagnosis": "diagnosis",
        "diagnosis code": "diagnosis",
        "icd-10": "diagnosis",
        "icd": "diagnosis",
        "dx": "diagnosis",
    }
    result = mappings.get(key)
    if result:
        return result

    # Fuzzy substring matching for partial OCR reads
    for label, canonical in mappings.items():
        if label in key or key in label:
            return canonical

    return None


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
