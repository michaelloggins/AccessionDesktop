"""Mock PaddleOCR-VL service for GPU-less development.

Returns realistic OCR responses that mimic the PaddleOCR-VL API format,
so you can develop and test the full workflow without an NVIDIA GPU.

Responses rotate through sample vet requisition forms matching MVD's MVP scope.
"""

import random

from fastapi import FastAPI, File, UploadFile

app = FastAPI(title="Mock PaddleOCR-VL")

# Sample OCR responses for vet requisition forms
SAMPLE_RESPONSES = [
    {
        "patient_name": "Buddy",
        "owner": "Sarah Johnson",
        "species": "Canine",
        "breed": "Golden Retriever",
        "dob": "03/15/2020",
        "physician": "Dr. Amanda Chen",
        "npi": "1234567890",
        "facility": "Banfield Pet Hospital #1247",
        "specimen_type": "Serum",
        "collection_date": "03/28/2026",
        "tests": ["Histoplasma Antigen"],
        "test_codes": ["HISTO_AG_VET"],
        "priority": "Routine",
        "diagnosis": "B39.4",
    },
    {
        "patient_name": "Whiskers",
        "owner": "Michael Torres",
        "species": "Feline",
        "breed": "Domestic Shorthair",
        "dob": "06/22/2019",
        "physician": "Dr. Robert Kim",
        "npi": "9876543210",
        "facility": "IndyVet Emergency",
        "specimen_type": "Urine",
        "collection_date": "03/30/2026",
        "tests": ["Histoplasma Antigen", "Blastomyces Antigen"],
        "test_codes": ["HISTO_AG_VET", "BLASTO_AG_VET"],
        "priority": "STAT",
        "diagnosis": "B40.9",
    },
    {
        "patient_name": "Max",
        "owner": "Jennifer Williams",
        "species": "Canine",
        "breed": "Labrador Retriever",
        "dob": "01/10/2018",
        "physician": "Dr. Lisa Patel",
        "npi": "5678901234",
        "facility": "VCA Shadeland",
        "specimen_type": "BAL",
        "collection_date": "03/29/2026",
        "tests": ["Blastomyces Antigen"],
        "test_codes": ["BLASTO_AG_VET"],
        "priority": "Routine",
        "diagnosis": "",
    },
]


def _build_markdown(sample: dict) -> str:
    """Build a realistic Markdown response mimicking PaddleOCR-VL output."""
    tests_str = ", ".join(sample["tests"])
    return f"""## Veterinary Requisition Form

| Field | Value |
|---|---|
| Patient Name | {sample["patient_name"]} |
| Owner Name | {sample["owner"]} |
| Species | {sample["species"]} |
| Breed | {sample["breed"]} |
| Date of Birth | {sample["dob"]} |
| Ordering Physician | {sample["physician"]} |
| NPI | {sample["npi"]} |
| Facility | {sample["facility"]} |
| Specimen Type | {sample["specimen_type"]} |
| Collection Date | {sample["collection_date"]} |
| Tests Ordered | {tests_str} |
| Priority | {sample["priority"]} |
| Diagnosis Code | {sample.get("diagnosis", "")} |

**MiraVista Diagnostics — Fungal Reference Laboratory**
4610 Lisborn Drive, Indianapolis, IN 46268
"""


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)):
    """Mock OCR endpoint matching PaddleOCR-VL response format."""
    # Read the file (we ignore the actual content in mock mode)
    contents = await file.read()
    file_size = len(contents)

    sample = random.choice(SAMPLE_RESPONSES)
    markdown = _build_markdown(sample)

    return {
        "errorCode": 0,
        "errorMsg": "Success",
        "result": {
            "pages": [
                {
                    "pageId": 0,
                    "markdown": markdown,
                    "layoutElements": [
                        {
                            "bbox": [50, 50, 750, 900],
                            "category": "table",
                            "text": markdown,
                        }
                    ],
                }
            ]
        },
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "model": "mock-paddleocr-vl", "gpu": "none"}
