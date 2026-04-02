"""Local validation engine for accession data.

Runs field-level checks using rules from validation_rules.json and
reference data (test_menu.json, specimen_types.json). All validation
happens locally — no network calls.
"""

import json
import logging
import os
import re
from typing import Optional

from app.core.config import settings
from app.models.accession import (
    AccessionPayload,
    ValidationError,
    ValidationResult,
)

logger = logging.getLogger(__name__)


def validate_accession(payload: AccessionPayload) -> ValidationResult:
    """Run all validation checks against an accession payload."""
    errors: list[ValidationError] = []

    errors.extend(_check_required_fields(payload))
    errors.extend(_check_field_formats(payload))
    errors.extend(_check_test_specimen_compatibility(payload))

    has_errors = any(e.severity == "error" for e in errors)

    return ValidationResult(valid=not has_errors, errors=errors)


def _check_required_fields(payload: AccessionPayload) -> list[ValidationError]:
    """Check that all required fields have values."""
    errors = []
    rules = _load_validation_rules()

    required_fields = rules.get("required_fields", [
        "patient.name",
        "ordering.customer_id",
        "specimen.type",
        "tests",
    ])

    for field_path in required_fields:
        value = _get_nested(payload, field_path)
        if not value or (isinstance(value, list) and len(value) == 0):
            errors.append(ValidationError(
                field=field_path,
                message=f"{field_path} is required",
                severity="error",
            ))

    return errors


def _check_field_formats(payload: AccessionPayload) -> list[ValidationError]:
    """Check field format patterns (DOB, MRN, NPI, etc.)."""
    errors = []
    rules = _load_validation_rules()
    format_rules = rules.get("format_checks", {})

    field_values = {
        "patient.dob": payload.patient.dob,
        "patient.mrn": payload.patient.mrn,
        "ordering.npi": payload.ordering.npi,
    }

    for field, value in field_values.items():
        if value and field in format_rules:
            pattern = format_rules[field].get("pattern")
            if pattern and not re.match(pattern, value):
                errors.append(ValidationError(
                    field=field,
                    message=format_rules[field].get(
                        "message", f"{field} format is invalid"
                    ),
                    severity=format_rules[field].get("severity", "error"),
                ))

    return errors


def _check_test_specimen_compatibility(
    payload: AccessionPayload,
) -> list[ValidationError]:
    """Check that ordered tests are compatible with the specimen type."""
    errors = []

    if not payload.specimen.type or not payload.tests:
        return errors

    specimen_types = _load_reference("specimen_types.json")
    if not specimen_types:
        return errors

    # Build a lookup: test_code → list of valid specimen types
    compatibility = {}
    for st in specimen_types:
        for test_code in st.get("compatible_tests", []):
            if test_code not in compatibility:
                compatibility[test_code] = []
            compatibility[test_code].append(st.get("code", ""))

    for test in payload.tests:
        if test.code in compatibility:
            if payload.specimen.type not in compatibility[test.code]:
                errors.append(ValidationError(
                    field="specimen.type",
                    message=(
                        f"Specimen type '{payload.specimen.type}' is not compatible "
                        f"with test '{test.name}' ({test.code}). "
                        f"Valid types: {', '.join(compatibility[test.code])}"
                    ),
                    severity="warning",
                ))

    return errors


def _get_nested(obj, path: str):
    """Get a nested attribute by dot path, e.g. 'patient.name'."""
    parts = path.split(".")
    current = obj
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current


_validation_rules_cache: Optional[dict] = None


def _load_validation_rules() -> dict:
    """Load validation rules from the synced config repo."""
    global _validation_rules_cache
    if _validation_rules_cache is not None:
        return _validation_rules_cache

    path = os.path.join(settings.config_path, "reference", "validation_rules.json")
    try:
        with open(path, "r") as f:
            _validation_rules_cache = json.load(f)
            return _validation_rules_cache
    except FileNotFoundError:
        logger.warning("Validation rules not found at %s", path)
        return {}


def _load_reference(filename: str) -> list:
    """Load a reference data file from the synced config repo."""
    path = os.path.join(settings.config_path, "reference", filename)
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("Reference file not found: %s", path)
        return []
