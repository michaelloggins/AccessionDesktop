"""Pydantic models for the config-driven gate check system."""

from typing import Optional

from pydantic import BaseModel


class GateDefinition(BaseModel):
    """A single gate check definition from gate_config.json."""
    id: str
    name: str
    trigger: str                        # before_scan, after_scan, before_submit, after_submit
    endpoint: str                       # APIM path, e.g. /api/gates/pre-scan
    method: str = "POST"
    required: bool = True
    allow_override: bool = False
    override_role: Optional[str] = None
    timeout_ms: int = 5000
    on_timeout: str = "warn"            # warn, fail, pass


class GateConfig(BaseModel):
    """Root model for gate_config.json."""
    gates: list[GateDefinition] = []


class GateRequest(BaseModel):
    """Request body sent to an APIM gate endpoint."""
    station_id: str
    operator_id: str
    specimen_id: Optional[str] = None
    tracking_number: Optional[str] = None
    context: dict = {}
