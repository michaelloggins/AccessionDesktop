# paddleocr-cpu/Dockerfile — PaddleOCR-VL 1.5 on CPU
# Slow (~30-60s/page) but works without GPU for dev/testing.
#
# Image is large (~4-5 GB) due to PaddlePaddle + model weights.
# On scan stations, use the official GPU image instead.

FROM python:3.11-slim

WORKDIR /app

# System dependencies for PaddlePaddle and image processing
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the API wrapper and test utilities
COPY main.py .
COPY test_capture.py .

# Pre-download the model weights during build so first request is faster.
# This adds ~2 GB to the image but avoids a long wait on first OCR call.
RUN python -c "from paddleocr import PaddleOCRVL; PaddleOCRVL(device='cpu')" \
    || echo "Model pre-download attempted — may complete on first request"

EXPOSE 8080

# Use 1 worker — the model is not thread-safe and CPU-bound anyway
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-keep-alive", "120"]
