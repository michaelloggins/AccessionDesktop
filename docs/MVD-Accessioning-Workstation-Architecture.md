# MVD Accessioning Workstation — Technical Architecture

## Project Overview

MiraVista Diagnostics (MVD) is building a unified accessioning workstation that combines document scanning, local AI-powered OCR extraction, specimen tracking gate checks (via Fulcrum/Madrigal), and StarLIMS integration into a single browser-based application running locally on each of 6 scan stations.

### Core Design Principles

- **PHI stays local** — Scanned images and extracted patient data remain on-premises. Only validated, structured accession payloads are transmitted to Azure/StarLIMS at the moment of final submission.
- **Local AI inference** — OCR/LLM runs on-device for speed and HIPAA compliance. No cloud AI APIs process PHI.
- **Disconnected-capable** — Operators can scan, extract, and fill accession forms even if connectivity to Azure drops. Submissions queue and flush when connectivity returns.
- **Config-driven gates** — Fulcrum specimen tracking gate checks are defined in config files, not hardcoded. New gates can be added without app redeployment.
- **Git-synced configuration** — Prompts, validation rules, reference data, and gate definitions are version-controlled in Azure DevOps and pulled to each station on a schedule.

---

## System Architecture

### Per-Station Docker Stack

Each of the 6 scan stations runs two containers:

```
scan-web-app (port 5000)
├── FastAPI backend
│   ├── TWAIN/eSCL scan capture interface
│   ├── AI OCR extraction client (calls localhost:8080)
│   ├── Accession form API (serves React frontend)
│   ├── Local validation engine
│   ├── Gate check orchestrator (calls APIM for Fulcrum gates)
│   ├── Autocomplete service (queries local customer_master.json)
│   ├── Supervisor override + audit logging
│   ├── Offline queue (queues submissions when Azure is unreachable)
│   └── Submit endpoint (HTTPS POST → Azure APIM → StarLIMS)
│
└── React frontend (served by FastAPI or nginx)
    ├── Scan capture UI
    ├── AI extraction results display
    ├── Accession form with autocomplete
    ├── Gate check status indicators
    ├── Validation error/warning display
    └── Supervisor override modal

paddleocr-vl (port 8080)
└── PaddleOCR-VL 1.5 (0.9B params)
    └── vLLM backend, OpenAI-compatible API
    └── Fully offline after initial model pull
```

### Network Architecture

```
Azure (Dev/Deploy/Coordination)          On-Prem (Runtime)
────────────────────────────────         ─────────────────
Azure DevOps Repos                       Scan Station ×6
  └── app source code          ──push──▶   ├── Docker: scan-web-app (:5000)
  └── prompts / rules / gates             ├── Docker: paddleocr-vl (:8080)
  └── CI/CD pipeline                      └── Git-synced config + data/

Azure Container Registry
  └── scan-app:latest          ──pull──▶ docker pull on each station

Azure Blob Storage
  └── customer_master.json     ──sync──▶ C:\OCR\data\ (3×/day)
  └── physician_npi.json       ──sync──▶ C:\OCR\data\ (daily)

Azure APIM + Functions                   ← HTTPS calls from stations
  └── POST /api/gates/{gate-id}            (Fulcrum gate checks)
  └── POST /api/accession/submit           (final accession → StarLIMS)
  └── POST /api/accession/batch-submit     (offline queue flush)
  └── GET  /api/lookup/physician/{query}   (real-time NPI lookup if needed)

Azure SQL (Compendium DB)
  └── LabTest, SpecimenType, Species, CustomerConfig, etc.

StarLIMS (LPH 1.2 API)
  └── Accession creation via Azure Functions middleware
```

---

## OCR / AI Layer

### Primary Model: PaddleOCR-VL 1.5

- **Parameters:** 0.9B
- **GPU VRAM:** ~8.5 GB
- **GPU Requirement:** NVIDIA RTX 3060+ (Compute Capability ≥ 8.0, CUDA 12.6+)
- **License:** Apache 2.0
- **Deployment:** Docker Compose with vLLM backend
- **API:** OpenAI-compatible chat completions on port 8118, PaddleX pipeline API on port 8080

#### Docker Compose Setup

```yaml
# docker-compose.yml (per station)
services:
  scan-app:
    image: mvdacr.azurecr.io/scan-web-app:latest
    ports:
      - "5000:5000"
    volumes:
      - C:\OCR\config-repo:/app/config:ro
      - C:\OCR\data:/app/data:ro
      - C:\OCR\queue:/app/queue
    environment:
      - OCR_API_URL=http://paddleocr:8080
      - APIM_BASE_URL=https://mvd-apim.azure-api.net
      - APIM_KEY=${APIM_SUBSCRIPTION_KEY}
    depends_on:
      paddleocr:
        condition: service_healthy
    restart: unless-stopped

  paddleocr:
    image: ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-vl:latest-nvidia-gpu
    # Or use community wrapper: edgaras0x4e/paddleocr-pdf-api:latest
    ports:
      - "8080:8080"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
    restart: unless-stopped
```

#### OCR API Call

```
POST http://localhost:8080/ocr
Content-Type: multipart/form-data

file=@scan.pdf
```

Response returns structured Markdown with tables, headings, and text blocks.

#### Direct VLM API Call (for custom prompting)

```
POST http://localhost:8118/v1/chat/completions
Content-Type: application/json

{
  "model": "PaddlePaddle/PaddleOCR-VL",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,<BASE64>"}},
        {"type": "text", "text": "OCR:"}
      ]
    }
  ],
  "temperature": 0.0
}
```

### Alternative Model: Qwen2.5-VL-7B (via Ollama)

Available as a fallback or for a centralized shared GPU server architecture.

- **Parameters:** 7B
- **GPU VRAM:** ~16 GB
- **Setup:** `ollama pull qwen2.5vl:7b`
- **API:** OpenAI-compatible on port 11434
- **Advantage:** Free-form prompting for flexible field extraction to JSON

### Evaluation Candidates

| Model | Params | VRAM | Strengths |
|-------|--------|------|-----------|
| PaddleOCR-VL 1.5 | 0.9B | ~8.5 GB | SOTA benchmarks, purpose-built, tiny footprint |
| Qwen2.5-VL-7B | 7B | ~16 GB | Flexible prompting, structured JSON output |
| OCRFlux-3B | 3B | ~12 GB | Cross-page table merging |
| DeepSeek-OCR | varies | varies | Token compression, memory efficient |
| Mistral OCR 3 | proprietary | N/A | Best handwriting — but cloud-only (HIPAA concern) |

---

## Operator Workflow

```
1. Operator logs in to scan station (http://localhost:5000)

2. 🚧 PRE-SCAN GATE (APIM → Fulcrum)
   - Specimen ready for this station?
   - Operator authorized?
   - Any intake condition flags?

3. Operator clicks SCAN
   - TWAIN/eSCL captures image from scanner
   - Image sent to local PaddleOCR-VL (localhost:8080)
   - AI extracts text, tables, fields → structured data

4. 🚧 POST-SCAN GATE(S) (as defined in gate config)
   - TBD — placeholder for future Fulcrum gates

5. ACCESSION FORM displayed, pre-filled from AI extraction
   - Customer autocomplete (local customer_master.json)
   - Physician lookup (local physician_npi.json or APIM)
   - Operator reviews, corrects, completes fields

6. LOCAL VALIDATION runs
   - Required fields present
   - Format checks (DOB, MRN patterns)
   - Test/specimen type compatibility (local rules)
   - Test menu validation (git-synced test_menu.json)

7. 🚧 PRE-SUBMIT GATE (APIM → Fulcrum)
   - Specimen received in Fulcrum?
   - Specimen status valid for accessioning?
   - Specimen type matches OCR extraction?
   - Chain of custody intact?
   - Temperature/condition flags → warn with supervisor override

8. SUBMIT
   - HTTPS POST → Azure APIM → Functions → StarLIMS LPH 1.2
   - Source document → Azure Blob Storage
   - Accession confirmation displayed
   - Next specimen prompt

9. 🚧 POST-SUBMIT GATE (as needed)
   - TBD — confirmation / Fulcrum status update
```

---

## Gate Check System

### Design Principles

- Gates are **config-driven** — defined in a JSON file synced via git, not hardcoded
- Each gate has a **trigger point** in the workflow (before_scan, after_scan, before_submit, after_submit)
- Gates call **APIM endpoints** that route to Fulcrum/Madrigal
- Gate results are **pass / warn / fail**
- Warnings can have **supervisor override** with role check and audit logging
- Hard fails **block the workflow** — no override available

### Gate Configuration

File: `config-repo/gates/gate_config.json`

```json
{
  "gates": [
    {
      "id": "pre-scan-specimen-ready",
      "name": "Specimen Ready Check",
      "trigger": "before_scan",
      "endpoint": "/api/gates/pre-scan",
      "method": "POST",
      "required": true,
      "allow_override": false,
      "timeout_ms": 5000,
      "on_timeout": "warn"
    },
    {
      "id": "pre-submit-fulcrum-status",
      "name": "Fulcrum Specimen Status",
      "trigger": "before_submit",
      "endpoint": "/api/gates/pre-submit",
      "method": "POST",
      "required": true,
      "allow_override": true,
      "override_role": "supervisor",
      "timeout_ms": 5000,
      "on_timeout": "warn"
    }
  ]
}
```

### Gate API Contract

Request (from scan-web-app → APIM):

```json
POST https://mvd-apim.azure-api.net/api/gates/{gate-id}

{
  "station_id": "SCAN-03",
  "operator_id": "mloggins",
  "specimen_id": "SP-2026-04-0142",
  "tracking_number": "FEDEX-789456123",
  "context": {
    "extracted_specimen_type": "Serum",
    "extracted_tests": ["HISTO_AG"],
    "customer_id": "CUST-1042"
  }
}
```

Response (from APIM → scan-web-app):

```json
{
  "gate_id": "pre-submit-fulcrum-status",
  "result": "warn",
  "checks": [
    {"check": "specimen_received", "result": "pass", "message": "Specimen received at 08:42 AM"},
    {"check": "status_valid", "result": "pass", "message": "Status: In Accessioning"},
    {"check": "specimen_type_match", "result": "pass", "message": "Serum matches intake log"},
    {"check": "condition_flags", "result": "warn", "message": "Condition flag: Slightly hemolyzed"}
  ],
  "allow_override": true,
  "override_role": "supervisor"
}
```

---

## Local Data & Configuration Sync

### File Structure

```
C:\OCR\
├── config-repo/                    # Git-synced from Azure DevOps
│   ├── prompts/
│   │   ├── requisition_system.txt  # System prompt for OCR extraction
│   │   ├── requisition_user.txt    # User prompt template
│   │   └── vet_requisition.txt     # Vet-specific prompt (MVP)
│   ├── reference/
│   │   ├── test_menu.json          # MiraVista test catalog
│   │   ├── specimen_types.json     # Valid specimen type codes + compatibility
│   │   └── validation_rules.json   # Field format regex, required fields
│   ├── gates/
│   │   └── gate_config.json        # Gate definitions (trigger, endpoint, override rules)
│   └── config/
│       ├── docker-compose.yml      # Service configuration
│       └── .env                    # Model version, ports, API keys
├── data/                           # Azure Blob-synced
│   ├── customer_master.json        # Customer/facility records (synced 3×/day)
│   │   # Includes: customer_id, name, facility_code, account_type,
│   │   # address, contacts, default_tests, specimen_source_map,
│   │   # rhapsody_config, active status
│   ├── physician_npi.json          # Physician directory (synced daily)
│   └── last_sync.json              # Sync timestamps per file
├── queue/                          # Offline submission queue
│   └── pending/                    # JSON payloads awaiting connectivity
├── logs/
│   ├── sync.log
│   ├── ocr.log
│   ├── gates.log
│   └── audit.log                   # Supervisor overrides, submissions
└── scripts/
    └── sync.ps1                    # Scheduled task: git pull + blob sync
```

### Sync Script (PowerShell 5.1)

```powershell
# C:\OCR\scripts\sync.ps1
# Runs as Scheduled Task every 5 minutes

$repoPath = "C:\OCR\config-repo"
$dataPath = "C:\OCR\data"
$logFile = "C:\OCR\logs\sync.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# --- Git sync (prompts, rules, gates) ---
try {
    Set-Location $repoPath
    $result = git pull origin main 2>&1

    if ($result -match "Already up to date") {
        Add-Content $logFile "$timestamp - Config: No changes"
    }
    else {
        Add-Content $logFile "$timestamp - Config updated: $result"

        if ($result -match "docker-compose.yml") {
            docker compose down
            docker compose up -d
            Add-Content $logFile "$timestamp - Service restarted"
        }
    }
}
catch {
    Add-Content $logFile "$timestamp - Config sync ERROR: $_"
}

# --- Blob sync (customer master, physician NPI) ---
$files = @(
    @{ Name = "customer_master.json"; Url = $env:BLOB_CUSTOMER_SAS },
    @{ Name = "physician_npi.json"; Url = $env:BLOB_PHYSICIAN_SAS }
)

foreach ($file in $files) {
    try {
        $localFile = Join-Path $dataPath $file.Name
        $headers = @{}
        $response = Invoke-WebRequest -Uri $file.Url -Method Head -Headers $headers

        $remoteModified = [DateTime]::Parse($response.Headers.'Last-Modified')
        $localModified = if (Test-Path $localFile) {
            (Get-Item $localFile).LastWriteTime
        } else {
            [DateTime]::MinValue
        }

        if ($remoteModified -gt $localModified) {
            Invoke-WebRequest -Uri $file.Url -OutFile $localFile
            Add-Content $logFile "$timestamp - $($file.Name) updated"
        }
    }
    catch {
        Add-Content $logFile "$timestamp - Blob sync ERROR ($($file.Name)): $_"
    }
}
```

---

## Customer Master Schema

Single unified file — customers and facilities are the same entity at MVD.

```json
[
  {
    "customer_id": "CUST-1042",
    "name": "IU Health Methodist",
    "facility_code": "IUH-METH",
    "account_type": "human_clinical",
    "address": {
      "street": "1701 N Senate Blvd",
      "city": "Indianapolis",
      "state": "IN",
      "zip": "46202"
    },
    "phone": "317-555-0142",
    "contacts": [
      {"name": "Jane Smith", "role": "Lab Director", "email": "jsmith@iuhealth.org"}
    ],
    "default_tests": ["HISTO_AG", "BLASTO_AG"],
    "preferred_specimen_types": ["Serum", "Urine"],
    "specimen_source_map": "IUHealth_SpecimenSource",
    "rhapsody_config": "IUH",
    "active": true
  },
  {
    "customer_id": "CUST-2087",
    "name": "Banfield Pet Hospital #1247",
    "facility_code": "BAN-1247",
    "account_type": "veterinary",
    "address": {
      "street": "8102 E 96th St",
      "city": "Fishers",
      "state": "IN",
      "zip": "46037"
    },
    "phone": "317-555-0287",
    "contacts": [],
    "default_tests": ["HISTO_AG_VET"],
    "preferred_specimen_types": ["Serum", "Urine"],
    "species_supported": ["Canine", "Feline"],
    "specimen_source_map": null,
    "rhapsody_config": null,
    "active": true
  }
]
```

---

## Accession Submit Payload

Final payload sent from scan-web-app → APIM → StarLIMS:

```json
POST https://mvd-apim.azure-api.net/api/accession/submit

{
  "station_id": "SCAN-03",
  "operator_id": "mloggins",
  "timestamp": "2026-04-01T14:32:00Z",
  "patient": {
    "name": "John Doe",
    "dob": "1980-01-15",
    "mrn": "MRN-123456",
    "species": "Human"
  },
  "ordering": {
    "customer_id": "CUST-1042",
    "facility_code": "IUH-METH",
    "physician": "Dr. Robert Smith",
    "npi": "1234567890"
  },
  "specimen": {
    "tracking_number": "FEDEX-789456123",
    "fulcrum_specimen_id": "SP-2026-04-0142",
    "type": "Serum",
    "source": "Blood",
    "collection_date": "2026-03-31",
    "received_date": "2026-04-01"
  },
  "tests": [
    {"code": "HISTO_AG", "name": "Histoplasma Antigen"},
    {"code": "BLASTO_AG", "name": "Blastomyces Antigen"}
  ],
  "priority": "Routine",
  "diagnosis_codes": ["B39.4"],
  "source_document_ref": "blob://mvd-scans/2026/04/01/SCAN-03-14320000.pdf",
  "gate_results": {
    "pre-scan-specimen-ready": {"result": "pass", "timestamp": "2026-04-01T14:28:00Z"},
    "pre-submit-fulcrum-status": {
      "result": "warn",
      "override": true,
      "override_by": "supervisor_jdoe",
      "override_reason": "Slight hemolysis acceptable per lab director",
      "timestamp": "2026-04-01T14:31:45Z"
    }
  }
}
```

---

## Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Backend | Python / FastAPI | Serves API + static frontend |
| Frontend | React (JSX artifact) | Tailwind CSS, shadcn/ui components |
| OCR Engine | PaddleOCR-VL 1.5 | 0.9B params, Docker, vLLM backend |
| Alt OCR | Qwen2.5-VL-7B via Ollama | For flexible prompting / shared GPU |
| Containerization | Docker Compose | Per-station stack |
| Registry | Azure Container Registry | CI/CD image hosting |
| Source Control | Azure DevOps Repos | App code + config + prompts |
| CI/CD | Azure DevOps Pipelines | Build → ACR → station pull |
| API Gateway | Azure APIM | Gate checks, accession submit, lookups |
| Middleware | Azure Functions | APIM → StarLIMS / Fulcrum routing |
| LIS | StarLIMS LPH 1.2 API | Accession creation (go-live July 2026) |
| Specimen Tracking | Fulcrum / Madrigal | Gate check source of truth |
| Reference DB | Azure SQL (Compendium) | LabTest, SpecimenType, CustomerConfig |
| Blob Storage | Azure Blob Storage | Source document archival |
| Config Sync | Git + PowerShell Scheduled Task | 5-minute interval |
| Data Sync | Azure Blob + PowerShell | Customer master 3×/day |
| Station OS | Windows 10/11 | Docker Desktop with NVIDIA Container Toolkit |
| Station GPU | NVIDIA RTX 4060+ (8 GB VRAM min) | For PaddleOCR-VL local inference |

---

## Hardware Requirements (Per Station)

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | RTX 3060 (8 GB) | RTX 4060 Ti (16 GB) |
| RAM | 16 GB | 32 GB |
| CPU | Intel i5 / Ryzen 5 | Intel i7 / Ryzen 7 |
| Storage | 256 GB SSD | 512 GB NVMe |
| OS | Windows 10 22H2 | Windows 11 |
| Docker | Docker Desktop 4.x | With NVIDIA Container Toolkit |
| CUDA | 12.6+ | Latest stable |
| Scanner | Any TWAIN/eSCL compatible | Duplex ADF recommended |

---

## MVP Scope (Vet-First)

Per the Customer Portal PRD v3.0 vet-first strategy:

1. **Single vet requisition form template** — AI prompt tuned for vet-specific fields (species, breed, owner name vs. patient name)
2. **Vet customer subset** in customer_master.json
3. **Species field** in accession form (not present in human clinical flow)
4. **Reduced gate checks** — pre-scan and pre-submit only
5. **Manual fallback** — if AI extraction confidence is low, form is blank and operator enters manually (same as today, no regression)

---

## Open Items / Future Considerations

- [ ] Fulcrum gate check API contracts — to be defined as Fulcrum/Madrigal develops
- [ ] Barcode scanning integration — read specimen barcodes at scan time to auto-link to Fulcrum
- [ ] Multi-page requisition handling — how to associate multiple scanned pages to one accession
- [ ] Operator training / rollout plan for 6 stations
- [ ] Offline queue max depth and alerting
- [ ] Source document retention policy (Azure Blob lifecycle)
- [ ] Integration with Rhapsody for outbound result delivery post-accessioning
- [ ] Model fine-tuning on MVD-specific requisition forms for higher extraction accuracy
- [ ] Evaluation benchmark: PaddleOCR-VL vs. Qwen2.5-VL-7B on 20 representative MVD documents
