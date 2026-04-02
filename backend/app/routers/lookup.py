"""Lookup endpoints — autocomplete for customers, physicians, tests."""

import json
import logging
import os

from fastapi import APIRouter, Query

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lookup", tags=["lookup"])


@router.get("/customers")
async def search_customers(q: str = Query(..., min_length=1)):
    """Search the local customer master for autocomplete.

    Searches by name, facility_code, and customer_id.
    """
    customers = _load_json(settings.data_path, "customer_master.json")
    q_lower = q.lower()

    results = [
        c for c in customers
        if c.get("active", True) and (
            q_lower in c.get("name", "").lower()
            or q_lower in c.get("facility_code", "").lower()
            or q_lower in c.get("customer_id", "").lower()
        )
    ]
    return results[:20]


@router.get("/physicians")
async def search_physicians(q: str = Query(..., min_length=2)):
    """Search the local physician NPI directory for autocomplete."""
    physicians = _load_json(settings.data_path, "physician_npi.json")
    q_lower = q.lower()

    results = [
        p for p in physicians
        if q_lower in p.get("name", "").lower()
        or q_lower in p.get("npi", "").lower()
    ]
    return results[:20]


@router.get("/tests")
async def search_tests(q: str = Query("", min_length=0)):
    """Search the test menu. Returns all tests if q is empty."""
    test_menu = _load_json(
        os.path.join(settings.config_path, "reference"), "test_menu.json"
    )

    if not q:
        return test_menu

    q_lower = q.lower()
    return [
        t for t in test_menu
        if q_lower in t.get("name", "").lower()
        or q_lower in t.get("code", "").lower()
    ]


def _load_json(directory: str, filename: str) -> list:
    """Load a JSON file, returning empty list on failure."""
    path = os.path.join(directory, filename)
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.warning("Could not load %s: %s", path, str(e))
        return []
