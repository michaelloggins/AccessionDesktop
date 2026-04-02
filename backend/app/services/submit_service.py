"""Accession submission service.

Handles the final submit to Azure APIM → StarLIMS, plus:
  - Source document upload to Azure Blob
  - Offline queue when Azure is unreachable
  - Queue flush when connectivity returns
"""

import json
import logging
import os
import uuid
from datetime import datetime

import httpx

from app.core.config import settings
from app.models.accession import AccessionPayload

logger = logging.getLogger(__name__)


async def submit_accession(
    payload: AccessionPayload,
    document_bytes: bytes | None = None,
) -> dict:
    """Submit an accession to Azure APIM.

    If the submit fails due to connectivity, the payload is queued locally
    and will be retried on the next flush cycle.

    Returns a dict with 'status', 'accession_id' (if successful), or 'queue_id' (if queued).
    """
    url = f"{settings.apim_base_url}/api/accession/submit"
    headers = {}
    if settings.apim_subscription_key:
        headers["Ocp-Apim-Subscription-Key"] = settings.apim_subscription_key

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                json=payload.model_dump(mode="json"),
                headers=headers,
            )
            response.raise_for_status()
            result = response.json()

            logger.info(
                "Accession submitted successfully",
                extra={"accession_id": result.get("accession_id")},
            )

            # Upload source document if provided
            if document_bytes and result.get("accession_id"):
                await _upload_source_document(
                    result["accession_id"], document_bytes, headers
                )

            return {"status": "submitted", **result}

    except (httpx.HTTPError, httpx.TimeoutException) as e:
        logger.warning("Submit failed, queuing offline: %s", str(e))
        queue_id = _queue_offline(payload, document_bytes)
        return {"status": "queued", "queue_id": queue_id}


async def _upload_source_document(
    accession_id: str, document_bytes: bytes, headers: dict
) -> None:
    """Upload the scanned source document to Azure Blob via APIM."""
    try:
        url = f"{settings.apim_base_url}/api/documents/upload"
        async with httpx.AsyncClient(timeout=60.0) as client:
            await client.post(
                url,
                files={"file": (f"{accession_id}.pdf", document_bytes)},
                data={"accession_id": accession_id},
                headers=headers,
            )
    except httpx.HTTPError as e:
        logger.error("Source document upload failed: %s", str(e))


def _queue_offline(
    payload: AccessionPayload, document_bytes: bytes | None
) -> str:
    """Save the accession payload to the offline queue for later retry."""
    queue_id = str(uuid.uuid4())
    queue_dir = settings.queue_path
    os.makedirs(queue_dir, exist_ok=True)

    queue_file = os.path.join(queue_dir, f"{queue_id}.json")
    queue_data = {
        "queue_id": queue_id,
        "queued_at": datetime.utcnow().isoformat(),
        "payload": payload.model_dump(mode="json"),
        "has_document": document_bytes is not None,
    }

    with open(queue_file, "w") as f:
        json.dump(queue_data, f, indent=2)

    # Save document bytes separately if present
    if document_bytes:
        doc_file = os.path.join(queue_dir, f"{queue_id}.pdf")
        with open(doc_file, "wb") as f:
            f.write(document_bytes)

    logger.info("Queued accession offline: %s", queue_id)
    return queue_id


async def flush_queue() -> list[dict]:
    """Attempt to submit all queued accessions. Called on connectivity restore."""
    queue_dir = settings.queue_path
    results = []

    if not os.path.exists(queue_dir):
        return results

    for filename in sorted(os.listdir(queue_dir)):
        if not filename.endswith(".json"):
            continue

        filepath = os.path.join(queue_dir, filename)
        with open(filepath, "r") as f:
            queue_data = json.load(f)

        payload = AccessionPayload(**queue_data["payload"])

        # Load document if it exists
        doc_bytes = None
        doc_path = filepath.replace(".json", ".pdf")
        if os.path.exists(doc_path):
            with open(doc_path, "rb") as f:
                doc_bytes = f.read()

        result = await submit_accession(payload, doc_bytes)

        if result["status"] == "submitted":
            # Remove from queue on success
            os.remove(filepath)
            if os.path.exists(doc_path):
                os.remove(doc_path)
            results.append({"queue_id": queue_data["queue_id"], **result})
        else:
            results.append({
                "queue_id": queue_data["queue_id"],
                "status": "still_queued",
            })

    return results
