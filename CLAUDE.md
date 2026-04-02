# CLAUDE.md — MVD Accessioning Workstation

## Project Summary

Building a unified accessioning workstation for MiraVista Diagnostics (MVD), a CAP/CLIA-certified fungal reference laboratory in Fishers/Indianapolis, Indiana. The app runs locally on 6 scan stations as a Docker stack, combining TWAIN document scanning, local AI-powered OCR, Fulcrum specimen tracking gate checks, and StarLIMS LIS integration into a single browser-based workflow.

## Architecture Overview

- **Local Docker stack per station:** FastAPI backend + React frontend (port 5000) + PaddleOCR-VL 1.5 (port 8080)
- **PHI stays on-prem** — only validated accession payloads leave the building at submit time via HTTPS to Azure APIM
- **Azure is dev/deploy/coordination** — Azure DevOps for source control and CI/CD, Azure Container Registry for images, Azure APIM + Functions for gate checks and StarLIMS middleware, Azure Blob for source document archival and reference data sync
- **Config-driven** — prompts, validation rules, gate definitions, and reference data are git-synced from Azure DevOps repos to each station every 5 minutes via PowerShell scheduled task

## Key Technical Decisions

- **OCR Model:** PaddleOCR-VL 1.5 (0.9B params, ~8.5 GB VRAM, Apache 2.0, SOTA benchmarks). Runs in Docker with vLLM backend. Alternative: Qwen2.5-VL-7B via Ollama for flexible prompting.
- **No cloud OCR** — Mistral OCR was evaluated but rejected due to proprietary licensing and cloud-only API (HIPAA concern).
- **Customer master = facility codes** — single unified JSON file, not separate lookups. Customers are facilities at MVD.
- **Watched folder pattern rejected** — building a native web app that calls the OCR API directly rather than using ScanToPDF + filesystem watching.
- **Gate checks call APIM in real-time** — unlike customer/test data which is cached locally, Fulcrum specimen status changes constantly and must be checked live.

## Workflow

1. Operator opens `http://localhost:5000`
2. **Pre-scan gate** (APIM → Fulcrum): specimen ready? operator authorized?
3. Scan captured via TWAIN → image sent to local PaddleOCR-VL → structured extraction
4. **Post-scan gates** (TBD, placeholder for future Fulcrum checks)
5. Accession form pre-filled from AI extraction, operator reviews/corrects
6. Autocomplete powered by local `customer_master.json` (synced from Azure Blob 3×/day)
7. **Local validation:** required fields, format checks, test/specimen compatibility
8. **Pre-submit gate** (APIM → Fulcrum): specimen received? status valid? type matches? condition flags?
9. Submit → HTTPS POST → Azure APIM → Functions → StarLIMS LPH 1.2 API
10. Source document uploaded to Azure Blob Storage

## Technology Stack

- **Backend:** Python / FastAPI
- **Frontend:** React with Tailwind CSS
- **OCR:** PaddleOCR-VL 1.5 in Docker (vLLM backend)
- **Containers:** Docker Compose, images in Azure Container Registry
- **API Gateway:** Azure APIM
- **Middleware:** Azure Functions (gate checks, StarLIMS routing)
- **LIS:** StarLIMS LPH 1.2 API (go-live July 2026)
- **Specimen Tracking:** Fulcrum / Madrigal (gate check source)
- **Reference DB:** Azure SQL (compendium — LabTest, SpecimenType, CustomerConfig)
- **Config Sync:** Git pull (5-min) + Azure Blob download (3×/day)
- **Station OS:** Windows 10/11 with Docker Desktop + NVIDIA Container Toolkit
- **Station GPU:** NVIDIA RTX 4060+ (8 GB VRAM minimum)

## File Structure (Per Station)

```
C:\OCR\
├── config-repo/              # Git-synced from Azure DevOps
│   ├── prompts/              # System/user prompts for OCR extraction
│   ├── reference/            # test_menu.json, specimen_types.json, validation_rules.json
│   ├── gates/                # gate_config.json (trigger points, endpoints, override rules)
│   └── config/               # docker-compose.yml, .env
├── data/                     # Azure Blob-synced
│   ├── customer_master.json  # Unified customer/facility records
│   ├── physician_npi.json    # Physician directory
│   └── last_sync.json
├── queue/                    # Offline submission queue
│   └── pending/
├── logs/
└── scripts/
    └── sync.ps1              # Git pull + blob sync scheduled task
```

## Coding Conventions

- **PowerShell:** Must be compatible with PowerShell 5.1. No PS 6+/7+ features (no ternary, no `??`, no `&&`/`||` operators).
- **Python:** FastAPI with async endpoints. Use Pydantic models for request/response validation.
- **React:** Functional components with hooks. Tailwind CSS for styling. No class components.
- **Docker:** Multi-stage builds. Pin base image versions. Health checks on all services.
- **Config files:** JSON for structured data, plain text for prompts. All in the git-synced config-repo.
- **API contracts:** OpenAPI/Swagger specs for all APIM endpoints.

## Gate System Design

Gates are config-driven. Each gate has: id, name, trigger point (before_scan / after_scan / before_submit / after_submit), APIM endpoint, required flag, allow_override flag, override_role, timeout, and on_timeout behavior. Gate definitions live in `config-repo/gates/gate_config.json` and are git-synced. Adding a new gate = add config entry + build APIM endpoint. No app redeployment needed.

Gate results are included in the final accession submit payload for audit trail, including any supervisor overrides with operator ID and reason.

## MVP Strategy

Vet-first per Customer Portal PRD v3.0. Start with a single vet requisition form template, vet customer subset, species/breed fields, and reduced gate checks (pre-scan + pre-submit only). Manual fallback if AI confidence is low.

## Related MVD Systems

- **Customer Portal** — PRD v3.0 complete, Azure APIM + Functions middleware, StarLIMS LPH 1.2 API (go-live July 2026)
- **Fulcrum / Madrigal** — Specimen tracking platform, source of truth for gate checks
- **Rhapsody 6.7** — HL7 integration engine (UPMC, IUHealth, etc.) — post-accessioning result delivery
- **Azure SQL Compendium** — Reference database (LabTest, SpecimenType, Species, CustomerConfig)
- **Monday.com** — EPR replacement / service management (Tickets board)

## Key Architecture Doc

See `MVD-Accessioning-Workstation-Architecture.md` for the full technical specification including Docker Compose configs, API contracts, gate check schemas, customer master schema, accession submit payload structure, sync scripts, and hardware requirements.
