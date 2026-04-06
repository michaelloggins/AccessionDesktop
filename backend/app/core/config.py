"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the scan-web-app backend."""

    # Station identity
    station_id: str = "DEV-01"

    # OCR service
    ocr_api_url: str = "http://ocr:8080"

    # Azure APIM
    apim_base_url: str = "https://mvd-apim.azure-api.net"
    apim_subscription_key: str = ""

    # URLIP Compendium API
    compendium_api_url: str = "http://host.docker.internal:7071/api/compendium"

    # Local paths (inside container)
    config_path: str = "/app/config"
    data_path: str = "/app/data"
    queue_path: str = "/app/queue/pending"
    log_path: str = "/app/logs"

    # Timeouts (ms)
    ocr_timeout_ms: int = 1800000  # 30 min — CPU inference is extremely slow
    gate_timeout_ms: int = 5000

    # Logging
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
