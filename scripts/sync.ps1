# C:\OCR\scripts\sync.ps1
# Runs as Windows Scheduled Task every 5 minutes
# Compatible with PowerShell 5.1 — no PS 6+/7+ features

$repoPath = "C:\OCR\config-repo"
$dataPath = "C:\OCR\data"
$logFile = "C:\OCR\logs\sync.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Ensure log directory exists
$logDir = Split-Path $logFile -Parent
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# --- Git sync (prompts, rules, gates, docker-compose) ---
try {
    Set-Location $repoPath
    $result = git pull origin main 2>&1

    if ($result -match "Already up to date") {
        Add-Content $logFile "$timestamp - Config: No changes"
    }
    else {
        Add-Content $logFile "$timestamp - Config updated: $result"

        # Restart services if docker-compose changed
        if ($result -match "docker-compose.yml") {
            docker compose down
            docker compose up -d
            Add-Content $logFile "$timestamp - Service restarted due to compose change"
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
    if (-not $file.Url) {
        # Skip if SAS URL not configured (dev environment)
        continue
    }

    try {
        $localFile = Join-Path $dataPath $file.Name
        $response = Invoke-WebRequest -Uri $file.Url -Method Head -UseBasicParsing

        $remoteModified = [DateTime]::Parse($response.Headers.'Last-Modified')

        if (Test-Path $localFile) {
            $localModified = (Get-Item $localFile).LastWriteTime
        }
        else {
            $localModified = [DateTime]::MinValue
        }

        if ($remoteModified -gt $localModified) {
            Invoke-WebRequest -Uri $file.Url -OutFile $localFile -UseBasicParsing
            Add-Content $logFile "$timestamp - $($file.Name) updated from blob"
        }
    }
    catch {
        Add-Content $logFile "$timestamp - Blob sync ERROR ($($file.Name)): $_"
    }
}
