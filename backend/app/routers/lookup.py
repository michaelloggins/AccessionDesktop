"""Lookup endpoints — autocomplete for customers, physicians, and compendium tests."""

import json
import logging
import os

import httpx
from fastapi import APIRouter, Query

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lookup", tags=["lookup"])

# Cache compendium in memory after first fetch
_compendium_cache: list | None = None


async def _fetch_compendium() -> list:
    """Fetch all tests from the URLIP compendium API, with in-memory caching."""
    global _compendium_cache
    if _compendium_cache is not None:
        return _compendium_cache

    all_tests = []
    page = 1
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            while True:
                url = f"{settings.compendium_api_url}?page={page}"
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                all_tests.extend(data.get("results", []))
                if page >= data.get("totalPages", 1):
                    break
                page += 1

        logger.info("Loaded %d tests from compendium API", len(all_tests))
        _compendium_cache = all_tests
    except httpx.HTTPError as e:
        logger.warning("Compendium API unavailable: %s, falling back to local", str(e))
        _compendium_cache = _load_local_test_menu()

    return _compendium_cache


def _load_local_test_menu() -> list:
    """Fallback: load static test_menu.json if compendium API is down."""
    path = os.path.join(settings.config_path, "reference", "test_menu.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


@router.get("/tests")
async def search_tests(
    q: str = Query("", min_length=0),
    market: str = Query("", description="Filter by market: Human or Veterinary"),
    species: str = Query("", description="Filter by species: Human, Canine, Feline"),
):
    """Search the compendium for tests. Filters by market and species."""
    compendium = await _fetch_compendium()
    results = []

    for test in compendium:
        # Filter by market (Human / Veterinary)
        if market and test.get("market", "").lower() != market.lower():
            continue

        # Filter by species
        if species:
            test_species = test.get("species", "").lower()
            if species.lower() not in test_species and test_species != "any":
                continue

        # Search by query
        if q:
            q_lower = q.lower()
            searchable = f"{test.get('mvdTestCode', '')} {test.get('testName', '')} {test.get('shortName', '')} {test.get('organism', '')} {test.get('category', '')}".lower()
            if q_lower not in searchable:
                continue

        # Build response with specimen types from orderableLoincs
        specimen_types = []
        for loinc in test.get("orderableLoincs", []):
            st = loinc.get("sampleType", "")
            if st and st not in specimen_types:
                specimen_types.append(st)

        results.append({
            "code": test.get("mvdTestCode", ""),
            "name": test.get("testName", ""),
            "short_name": test.get("shortName", ""),
            "category": test.get("category", ""),
            "methodology": test.get("methodology", ""),
            "organism": test.get("organism", ""),
            "market": test.get("market", ""),
            "species": test.get("species", ""),
            "tat": test.get("tat", ""),
            "specimen_types": specimen_types,
            "orderable_loincs": [
                {
                    "loinc_code": ol.get("orderLoincCode", ""),
                    "sample_type": ol.get("sampleType", ""),
                    "acceptable_sources": ol.get("acceptableSources", []),
                    "sample_handling": ol.get("sampleHandling", ""),
                    "reference_range": ol.get("referenceRange", ""),
                }
                for ol in test.get("orderableLoincs", [])
            ],
        })

    return results


@router.get("/tests/{code}")
async def get_test(code: str):
    """Get a single test by MVD test code with full details."""
    compendium = await _fetch_compendium()
    for test in compendium:
        if test.get("mvdTestCode") == code:
            return test
    return {"error": "Test not found"}


@router.post("/compendium/refresh")
async def refresh_compendium():
    """Force refresh the compendium cache from the API."""
    global _compendium_cache
    _compendium_cache = None
    tests = await _fetch_compendium()
    return {"status": "refreshed", "total": len(tests)}


@router.get("/customers")
async def search_customers(q: str = Query(..., min_length=1)):
    """Search the local customer master for autocomplete."""
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


def _load_json(directory: str, filename: str) -> list:
    """Load a JSON file, returning empty list on failure."""
    path = os.path.join(directory, filename)
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.warning("Could not load %s: %s", path, str(e))
        return []
