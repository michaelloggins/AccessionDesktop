"""Pydantic models for accession data — the core data contracts.

These models define the shape of data as it flows through:
  OCR extraction → form pre-fill → validation → gate checks → submit payload
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Patient ---

class Patient(BaseModel):
    name: str = ""                       # Vet: pet name, Human: last name
    first_name: Optional[str] = None     # Human only
    middle_name: Optional[str] = None    # Human only
    dob: Optional[str] = None
    mrn: Optional[str] = None
    accession_id: Optional[str] = None   # Human: pre-assigned accession ID
    species: Optional[str] = None        # Vet: Canine, Feline, etc.
    breed: Optional[str] = None          # Vet
    owner_name: Optional[str] = None     # Vet: pet owner


# --- Ordering Info ---

class OrderingInfo(BaseModel):
    customer_id: Optional[str] = None
    facility_code: Optional[str] = None
    physician: Optional[str] = None
    npi: Optional[str] = None


# --- Specimen ---

class Specimen(BaseModel):
    tracking_number: Optional[str] = None
    fulcrum_specimen_id: Optional[str] = None
    type: Optional[str] = None          # Serum, Urine, BAL, CSF, Tissue, Other
    source: Optional[str] = None
    collection_date: Optional[str] = None
    received_date: Optional[str] = None


# --- Test ---

class TestOrder(BaseModel):
    code: str
    name: str
    specimen_type: Optional[str] = None  # UR, SER, PLS, CSF, BAL, Other


# --- Gate Results ---

class GateCheckDetail(BaseModel):
    check: str
    result: str                         # pass, warn, fail
    message: str


class GateOverride(BaseModel):
    override_by: str
    override_reason: str
    timestamp: datetime


class GateResult(BaseModel):
    gate_id: str
    result: str                         # pass, warn, fail
    checks: list[GateCheckDetail] = []
    allow_override: bool = False
    override_role: Optional[str] = None
    override: Optional[GateOverride] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# --- OCR Extraction ---

class OcrExtraction(BaseModel):
    """Structured fields extracted from OCR output."""
    raw_markdown: str = ""
    patient: Patient = Field(default_factory=Patient)
    ordering: OrderingInfo = Field(default_factory=OrderingInfo)
    specimen: Specimen = Field(default_factory=Specimen)
    tests: list[TestOrder] = []
    priority: Optional[str] = None
    diagnosis_codes: list[str] = []
    confidence: float = 0.0             # 0.0–1.0, triggers manual fallback if low


# --- Accession Submit Payload ---

class AccessionPayload(BaseModel):
    """Final payload sent to Azure APIM → StarLIMS."""
    station_id: str
    operator_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    order_type: str = "veterinary"      # "veterinary" or "human"
    manifest_mode: bool = False          # True if part of a multi-order manifest
    manifest_index: Optional[int] = None # Order number within manifest batch
    patient: Patient
    ordering: OrderingInfo
    specimen: Specimen
    tests: list[TestOrder]
    priority: str = "Routine"
    diagnosis_codes: list[str] = []
    source_document_ref: Optional[str] = None
    gate_results: dict[str, GateResult] = {}


# --- Validation ---

class ValidationError(BaseModel):
    field: str
    message: str
    severity: str = "error"             # error, warning


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationError] = []
