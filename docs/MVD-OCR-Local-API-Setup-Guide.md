# MVD OCR/AI Model Evaluation & Local API Setup Guide

## Quick Comparison Matrix

| Model | Parameters | GPU VRAM | Local Self-Host | API Style | License | Best For |
|-------|-----------|----------|-----------------|-----------|---------|----------|
| **PaddleOCR-VL 1.5** | 0.9B | ~8.5 GB | ✅ Docker + vLLM | REST (PaddleX) | Apache 2.0 | Purpose-built doc parsing, SOTA benchmarks |
| **Qwen2.5-VL-7B** | 7B | ~16 GB | ✅ Ollama or vLLM | OpenAI-compatible | Apache 2.0 | General VLM + OCR, structured JSON output |
| **Mistral OCR 3** | Proprietary | N/A local* | ⚠️ Cloud API only* | Mistral SDK / REST | Proprietary | Handwriting, complex tables, forms |

*Mistral OCR self-hosting requires contacting Mistral sales for on-premises licensing. It is NOT an open-source model you can download and run. For your HIPAA/local-only requirement, this is a significant limitation.

---

## Option 1: PaddleOCR-VL 1.5 (Recommended for MVD)

### Why This One
- Smallest footprint (0.9B params, ~8.5 GB VRAM)
- Highest benchmark scores (94.5% OmniDocBench v1.5)
- Purpose-built for document parsing — not a general chat model doing OCR on the side
- Runs on an RTX 3060/4060 class GPU comfortably
- Apache 2.0 — no licensing concerns
- Fully offline after initial image pull

### Setup: Docker Compose (Production Recommended)

**Prerequisites:**
- NVIDIA GPU with Compute Capability ≥ 8.0 (RTX 30/40/50 series, A10, A100)
- NVIDIA Driver supporting CUDA 12.6+
- Docker + Docker Compose
- NVIDIA Container Toolkit installed

**Step 1: Download compose files**

```bash
mkdir paddleocr-vl && cd paddleocr-vl

# Download official compose and env files
curl -O https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/deploy/paddleocr_vl_docker/compose.yaml
curl -O https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/deploy/paddleocr_vl_docker/.env
```

**Step 2: Review/edit .env file**

```ini
# .env file contents
API_IMAGE_TAG_SUFFIX=latest-nvidia-gpu
VLM_BACKEND=vllm
VLM_IMAGE_TAG_SUFFIX=latest-nvidia-gpu
```

> For RTX 50-series (Blackwell), change tag suffix to `latest-nvidia-gpu-sm120`

**Step 3: Start the service**

```bash
docker compose up -d
```

First run downloads ~2 GB of model weights. Service listens on **port 8080** once healthy.

**Step 4: Verify health**

```bash
curl http://localhost:8080/health
```

### API Usage

**Endpoint:** `POST http://localhost:8080/ocr`

**Request — Image file (multipart form):**

```bash
curl -X POST http://localhost:8080/ocr \
  -F "file=@/path/to/scan.png"
```

**Request — Image via base64 in JSON:**

```bash
curl -X POST http://localhost:8080/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "file": "data:image/png;base64,iVBORw0KGgo...",
    "fileType": 1
  }'
```

**Request — PDF file:**

```bash
curl -X POST http://localhost:8080/ocr \
  -F "file=@/path/to/requisition.pdf"
```

**Response (JSON):**

```json
{
  "errorCode": 0,
  "errorMsg": "Success",
  "result": {
    "pages": [
      {
        "pageId": 0,
        "markdown": "## Patient Requisition Form\n\n| Field | Value |\n|---|---|\n| Patient Name | John Doe |\n| DOB | 01/15/1980 |\n| Specimen Type | Serum |\n| Test Ordered | Histoplasma Antigen |\n...",
        "layoutElements": [
          {
            "bbox": [x1, y1, x2, y2],
            "category": "table",
            "text": "..."
          }
        ]
      }
    ]
  }
}
```

The key output field is `markdown` — PaddleOCR-VL converts the entire page into structured Markdown including tables, headings, and text blocks.

### Prompting / Customizing Extraction

PaddleOCR-VL uses task-specific prefixes rather than free-form prompts. When calling the underlying VLM directly (via the vLLM OpenAI-compatible endpoint on port 8118), you can use these task prefixes:

```
OCR:              — General text extraction
Table Recognition: — Focus on table structures
Formula Recognition: — Math/scientific formulas
Chart Recognition:  — Charts and graphs
```

**Direct VLM API call (advanced — bypasses the pipeline):**

```bash
curl -X POST http://localhost:8118/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "PaddlePaddle/PaddleOCR-VL",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/png;base64,<BASE64_IMAGE_DATA>"
            }
          },
          {
            "type": "text",
            "text": "OCR:"
          }
        ]
      }
    ],
    "temperature": 0.0
  }'
```

### Alternative: Community FastAPI Wrapper (Simpler API)

For a simpler REST API with job queuing (good for batch scanning):

```yaml
# docker-compose.yml
services:
  paddleocr:
    image: edgaras0x4e/paddleocr-pdf-api:latest
    ports:
      - "8099:8000"
    volumes:
      - ocr-data:/data
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
volumes:
  ocr-data:
```

```bash
# Submit a scan
curl -X POST http://localhost:8099/ocr -F "file=@requisition.pdf"
# Response: {"job_id": "abc123...", "status": "queued"}

# Check progress
curl http://localhost:8099/ocr/abc123

# Get results (returns markdown per page)
curl http://localhost:8099/ocr/abc123
# Response includes: {"status": "completed", "pages": [...]}
```

---

## Option 2: Qwen2.5-VL-7B via Ollama

### Why This One
- More flexible prompting (free-form natural language)
- Excellent at structured JSON output on demand
- OpenAI-compatible API out of the box
- Larger community, more examples
- Good for "understand the document AND extract specific fields" workflows

### Setup: Ollama (Simplest Path)

**Prerequisites:**
- 16+ GB GPU VRAM (RTX 4070 Ti / 4080 / 4090, or RTX 3090)
- Ollama installed (https://ollama.com)

**Step 1: Install Ollama**

```bash
# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows — download installer from https://ollama.com/download
```

**Step 2: Pull the model**

```bash
ollama pull qwen2.5vl:7b
```

**Step 3: Ollama runs automatically as a service**

API is available at `http://localhost:11434`

### API Usage

**Endpoint:** `POST http://localhost:11434/v1/chat/completions`

Ollama exposes an **OpenAI-compatible** API. This is what your scan station app calls.

**Request — OCR with structured extraction:**

```bash
curl -X POST http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5vl:7b",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/png;base64,<BASE64_ENCODED_IMAGE>"
            }
          },
          {
            "type": "text",
            "text": "Extract all text from this lab requisition form. Return as JSON with fields: patient_name, dob, ordering_physician, specimen_type, tests_ordered, collection_date, priority. If a field is not found, use null."
          }
        ]
      }
    ],
    "temperature": 0.1,
    "max_tokens": 2048
  }'
```

**Response:**

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "```json\n{\n  \"patient_name\": \"John Doe\",\n  \"dob\": \"01/15/1980\",\n  \"ordering_physician\": \"Dr. Smith\",\n  \"specimen_type\": \"Serum\",\n  \"tests_ordered\": [\"Histoplasma Antigen\", \"Blastomyces Antigen\"],\n  \"collection_date\": \"2026-03-28\",\n  \"priority\": \"Routine\"\n}\n```"
      }
    }
  ]
}
```

**Ollama Native API (alternative endpoint):**

```bash
curl -X POST http://localhost:11434/api/generate \
  -d '{
    "model": "qwen2.5vl:7b",
    "prompt": "Extract all text from this document image and return as structured JSON.",
    "images": ["<BASE64_IMAGE_NO_PREFIX>"],
    "stream": false
  }'
```

### Prompting Strategy for MVD Scans

The power of Qwen2.5-VL is free-form prompting. Here's how to structure prompts for your req forms:

```
SYSTEM PROMPT (set once per session):
"You are a lab requisition form OCR processor for MiraVista Diagnostics.
Extract structured data from scanned requisition forms.
Always return valid JSON. Never hallucinate field values — use null if uncertain.
Specimen types must match: Serum, Urine, BAL, CSF, Tissue, Other.
Test codes must match the MiraVista test menu."

USER PROMPT (per image):
"Process this scanned requisition form. Extract and return JSON:
{
  \"patient\": {\"name\": \"\", \"dob\": \"\", \"mrn\": \"\"},
  \"ordering\": {\"physician\": \"\", \"facility\": \"\", \"npi\": \"\"},
  \"specimen\": {\"type\": \"\", \"collection_date\": \"\", \"source\": \"\"},
  \"tests\": [{\"code\": \"\", \"name\": \"\"}],
  \"priority\": \"\",
  \"diagnosis_codes\": []
}"
```

### Setup: vLLM (Higher Throughput — Better for Shared GPU Server)

If you go with the centralized GPU server model:

```bash
pip install vllm

vllm serve Qwen/Qwen2.5-VL-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.85
```

Same OpenAI-compatible API, but at `http://<server-ip>:8000/v1/chat/completions`.

---

## Option 3: Mistral OCR 3

### Important Caveat for MVD
Mistral OCR is **NOT open-source**. It is a proprietary cloud API at `https://api.mistral.ai/v1/ocr`. Self-hosting requires contacting Mistral's sales team for enterprise on-premises licensing. This means:
- You cannot download and run it locally without a contract
- Cloud API usage sends documents to Mistral's servers (HIPAA concern)
- Pricing: ~$2/1,000 pages ($1 with batch API)

**For your HIPAA-compliant, locally-controlled requirement, Mistral OCR is not viable unless you pursue their enterprise self-hosting agreement.**

### API Reference (Cloud — for evaluation only)

```bash
curl -X POST https://api.mistral.ai/v1/ocr \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-ocr-latest",
    "document": {
      "type": "image_url",
      "image_url": "data:image/png;base64,<BASE64_IMAGE>"
    },
    "include_image_base64": false
  }'
```

**Response:**

```json
{
  "pages": [
    {
      "index": 0,
      "markdown": "## Requisition Form\n\n| Patient Name | John Doe |\n...",
      "images": [],
      "dimensions": {"dpi": 200, "height": 2200, "width": 1700}
    }
  ],
  "model": "mistral-ocr-2512",
  "usage_info": {"pages_processed": 1, "doc_size_bytes": 145349}
}
```

---

## Sync Architecture for Decentralized Deployment

Regardless of which model you choose, here's how to keep 6 scan stations in sync:

### What Gets Synced (Layered Approach)

| Layer | Contents | Sync Method | Frequency |
|-------|----------|-------------|-----------|
| **Model Weights** | .onnx / .safetensors files | Azure Files SMB share or Docker image tag | Quarterly |
| **Prompts & Rules** | System prompts, extraction templates, field validation | Git repo (Azure DevOps) | On commit (minutes) |
| **Reference Data** | Test menu, specimen type maps, facility codes | Git repo or REST config endpoint | On commit |
| **Docker Compose** | Service config, port mappings, GPU allocation | Git repo | On commit |

### Git-Based Sync (Recommended)

```
azure-devops-repo/
├── prompts/
│   ├── requisition_system.txt      # System prompt for req form OCR
│   ├── requisition_user.txt        # User prompt template
│   ├── specimen_label_system.txt   # System prompt for specimen labels
│   └── fax_cover_system.txt        # System prompt for fax covers
├── reference/
│   ├── test_menu.json              # MiraVista test catalog
│   ├── specimen_types.json         # Valid specimen type codes
│   ├── facility_codes.json         # Known facility mappings
│   └── validation_rules.json       # Field validation regex/rules
├── config/
│   ├── docker-compose.yml          # Service configuration
│   └── .env                        # Model version, ports, GPU settings
└── scripts/
    └── sync.ps1                    # Scheduled pull script
```

**Sync script (PowerShell 5.1 compatible):**

```powershell
# C:\OCR\scripts\sync.ps1
# Runs as Scheduled Task every 5 minutes

$repoPath = "C:\OCR\config-repo"
$logFile = "C:\OCR\logs\sync.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    Set-Location $repoPath
    $result = git pull origin main 2>&1
    
    if ($result -match "Already up to date") {
        # No changes
        Add-Content $logFile "$timestamp - No changes"
    }
    else {
        Add-Content $logFile "$timestamp - Updated: $result"
        
        # Restart OCR service if docker-compose changed
        if ($result -match "docker-compose.yml") {
            docker compose down
            docker compose up -d
            Add-Content $logFile "$timestamp - Service restarted"
        }
    }
}
catch {
    Add-Content $logFile "$timestamp - ERROR: $_"
}
```

**Register as Scheduled Task:**

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\OCR\scripts\sync.ps1"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -At (Get-Date) -Once
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName "OCR-Config-Sync" `
    -Action $action -Trigger $trigger -Settings $settings `
    -User "SYSTEM" -RunLevel Highest
```

### How Your Scan App Loads Prompts

Your scan station application reads prompts from the local git repo at runtime:

```python
import json
import os

CONFIG_PATH = r"C:\OCR\config-repo"

def load_prompt(prompt_name):
    """Load a prompt template from the synced config repo."""
    path = os.path.join(CONFIG_PATH, "prompts", f"{prompt_name}.txt")
    with open(path, 'r') as f:
        return f.read()

def load_reference(ref_name):
    """Load reference data (test menu, specimen types, etc.)."""
    path = os.path.join(CONFIG_PATH, "reference", f"{ref_name}.json")
    with open(path, 'r') as f:
        return json.load(f)

# Usage in scan workflow:
system_prompt = load_prompt("requisition_system")
user_template = load_prompt("requisition_user")
test_menu = load_reference("test_menu")

# Inject reference data into prompt
system_prompt_with_context = system_prompt + "\n\nValid tests: " + json.dumps(test_menu)
```

---

## Evaluation Test Plan

To compare models head-to-head, scan 10-20 representative documents from each category MVD processes:

1. **Typed requisition forms** (your most common input)
2. **Handwritten requisition forms** (if applicable)
3. **Faxed/low-quality scans** (noise, skew, compression artifacts)
4. **Specimen labels** (small text, barcodes adjacent)
5. **Mixed-format documents** (tables + free text + logos)

**Score each model on:**
- Field extraction accuracy (did it get the patient name, DOB, tests right?)
- Hallucination rate (did it invent data that wasn't on the form?)
- Processing time per page
- Handling of poor scan quality

---

## Hardware Recommendation Per Architecture

### Fully Decentralized (6 local stations)
- **GPU per station:** RTX 4060 (8 GB) for PaddleOCR-VL, or RTX 4070 Ti (16 GB) for Qwen2.5-VL-7B
- **Total GPU cost:** ~$1,800–$4,800 (6 × $300–$800)
- **Pros:** Fastest inference, no network dependency, survives server outage
- **Cons:** 6 GPUs to manage, sync overhead

### Shared GPU Server (1 central, 6 clients)
- **GPU:** RTX 4090 (24 GB) or A4000 (16 GB)
- **Total GPU cost:** ~$800–$1,600
- **Pros:** Single point of management, easier model updates
- **Cons:** Network latency, single point of failure, concurrent request queuing

### Hybrid (Recommended)
- PaddleOCR-VL on each station (tiny footprint, fast, purpose-built)
- Central Qwen2.5-VL-7B server for "second opinion" / complex extractions
- Git-synced prompts and rules across all nodes
