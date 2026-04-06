"""Address endpoints — Azure Maps autocomplete and facility lookup via RASCLIENTS."""

import logging

import httpx
from fastapi import APIRouter, Query

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/address", tags=["address"])


@router.get("/autocomplete")
async def address_autocomplete(q: str = Query(..., min_length=2)):
    """Autocomplete address using Azure Maps Search Address API.

    Returns structured address suggestions as the user types.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.azure_maps_url}/search/address/json",
                params={
                    "api-version": "1.0",
                    "query": q,
                    "limit": 8,
                    "countrySet": "US",
                    "subscription-key": settings.azure_maps_key,
                },
            )
            response.raise_for_status()
            data = response.json()

        # Parse Azure Maps Search Address v1 response
        suggestions = []
        for result in data.get("results", []):
            addr = result.get("address", {})
            street = f"{addr.get('streetNumber', '')} {addr.get('streetName', '')}".strip()
            suggestions.append({
                "formatted": addr.get("freeformAddress", ""),
                "address1": street,
                "city": addr.get("municipality", ""),
                "state": addr.get("countrySubdivision", ""),
                "zip": addr.get("postalCode", ""),
                "country": addr.get("countryCode", "US"),
            })

        return suggestions

    except httpx.HTTPError as e:
        logger.error("Azure Maps error: %s", str(e))
        return []


@router.get("/facility/search")
async def facility_search(q: str = Query(..., min_length=1), limit: int = 20):
    """Search RASCLIENTS via the facility-lookup Azure Function."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.facility_api_url}/facility/search",
                params={"q": q, "limit": limit},
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.warning("Facility search error: %s", str(e))
        return []


@router.get("/facility/lookup")
async def facility_lookup(id: str = Query(...)):
    """Lookup a single facility by ExternalClientID from RASCLIENTS."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.facility_api_url}/facility/lookup",
                params={"id": id},
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.warning("Facility lookup error: %s", str(e))
        return {"error": str(e)}


@router.get("/facility/validate")
async def facility_validate(
    name: str = Query(""),
    address: str = Query(""),
    city: str = Query(""),
    state: str = Query(""),
    zip: str = Query(""),
):
    """Match facilities in RASCLIENTS by name/address to find ExternalClientID candidates."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.facility_api_url}/facility/validate",
                params={"name": name, "address": address, "city": city, "state": state, "zip": zip},
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.warning("Facility validate error: %s", str(e))
        return {"matches": 0, "results": []}
