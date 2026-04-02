"""Gate check endpoints — trigger config-driven Fulcrum checks."""

import logging

from fastapi import APIRouter

from app.models.accession import GateResult
from app.models.gates import GateRequest
from app.services.gate_checker import run_gates

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gates", tags=["gates"])


@router.post("/check/{trigger}", response_model=dict[str, GateResult])
async def check_gates(trigger: str, request: GateRequest):
    """Execute all gate checks for a trigger point.

    Trigger points: before_scan, after_scan, before_submit, after_submit

    Returns a dict of {gate_id: GateResult} for each gate in the trigger.
    """
    results = await run_gates(trigger, request)
    return results
