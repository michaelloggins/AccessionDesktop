"""Mock Azure APIM service for local development.

Simulates gate check responses and accession submission
so the full workflow can be tested without Azure connectivity.
"""

import uuid
from datetime import datetime

from fastapi import FastAPI, Request

app = FastAPI(title="Mock Azure APIM")


@app.post("/api/gates/{gate_id}")
async def gate_check(gate_id: str, request: Request):
    """Mock gate check — returns pass for most checks, warn for condition flags."""
    body = await request.json()

    if gate_id == "pre-scan":
        return {
            "gate_id": "pre-scan-specimen-ready",
            "result": "pass",
            "checks": [
                {"check": "specimen_received", "result": "pass", "message": "Specimen received (mock)"},
                {"check": "operator_authorized", "result": "pass", "message": "Operator authorized (mock)"},
            ],
            "allow_override": False,
        }

    if gate_id == "pre-submit":
        return {
            "gate_id": "pre-submit-fulcrum-status",
            "result": "pass",
            "checks": [
                {"check": "specimen_received", "result": "pass", "message": "Specimen received (mock)"},
                {"check": "status_valid", "result": "pass", "message": "Status: In Accessioning (mock)"},
                {"check": "specimen_type_match", "result": "pass", "message": "Type matches intake (mock)"},
                {"check": "condition_flags", "result": "pass", "message": "No condition flags (mock)"},
            ],
            "allow_override": True,
            "override_role": "supervisor",
        }

    return {"gate_id": gate_id, "result": "pass", "checks": []}


@app.post("/api/accession/submit")
async def submit_accession(request: Request):
    """Mock accession submit — always succeeds with a fake accession ID."""
    body = await request.json()
    accession_id = f"ACC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    return {
        "accession_id": accession_id,
        "status": "created",
        "message": "Accession created successfully (mock)",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/api/accession/batch-submit")
async def batch_submit(request: Request):
    """Mock batch submit for offline queue flush."""
    return {"status": "ok", "processed": 0}


@app.post("/api/documents/upload")
async def upload_document():
    """Mock document upload — accepts and discards."""
    return {"status": "uploaded", "message": "Document stored (mock)"}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "mock-apim"}
