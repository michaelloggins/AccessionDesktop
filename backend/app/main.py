"""MVD Accessioning Workstation — FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import accession, gates, lookup, scan
from app.services.gate_checker import load_gate_config

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MVD Accessioning Workstation",
    description="Local scan station API — OCR, gate checks, validation, and accession submission",
    version="0.1.0",
)

# CORS — allow the React frontend (dev on port 3000, prod served by nginx)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(scan.router)
app.include_router(gates.router)
app.include_router(accession.router)
app.include_router(lookup.router)


@app.on_event("startup")
async def startup():
    """Load configuration on startup."""
    load_gate_config()
    logger.info("Station %s started", settings.station_id)


@app.get("/health")
async def health():
    """Health check endpoint for Docker healthcheck."""
    return {"status": "healthy", "station_id": settings.station_id}
