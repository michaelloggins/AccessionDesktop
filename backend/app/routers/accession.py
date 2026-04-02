"""Accession form endpoints — validation, submit, and queue management."""

import logging

from fastapi import APIRouter

from app.models.accession import AccessionPayload, ValidationResult
from app.services.submit_service import flush_queue, submit_accession
from app.services.validator import validate_accession

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/accession", tags=["accession"])


@router.post("/validate", response_model=ValidationResult)
async def validate(payload: AccessionPayload):
    """Run local validation on an accession payload before submit.

    Checks required fields, format patterns, and test/specimen compatibility.
    """
    return validate_accession(payload)


@router.post("/submit")
async def submit(payload: AccessionPayload):
    """Submit a validated accession to Azure APIM → StarLIMS.

    If Azure is unreachable, the payload is queued locally for retry.
    """
    result = await submit_accession(payload)
    return result


@router.post("/flush-queue")
async def flush():
    """Attempt to submit all queued accessions (offline queue flush)."""
    results = await flush_queue()
    return {"flushed": len(results), "results": results}
