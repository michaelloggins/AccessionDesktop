"""Config-driven gate check orchestrator.

Loads gate definitions from gate_config.json, executes APIM calls at the
appropriate trigger points, and returns pass/warn/fail results with override
support.
"""

import json
import logging
import os
from datetime import datetime

import httpx

from app.core.config import settings
from app.models.accession import GateCheckDetail, GateResult
from app.models.gates import GateConfig, GateDefinition, GateRequest

logger = logging.getLogger(__name__)

_gate_config: GateConfig | None = None


def load_gate_config() -> GateConfig:
    """Load gate definitions from the synced config repo. Cached after first load."""
    global _gate_config
    path = os.path.join(settings.config_path, "gates", "gate_config.json")
    try:
        with open(path, "r") as f:
            _gate_config = GateConfig(**json.load(f))
    except FileNotFoundError:
        logger.warning("Gate config not found at %s, using empty config", path)
        _gate_config = GateConfig()
    return _gate_config


def get_gates_for_trigger(trigger: str) -> list[GateDefinition]:
    """Return all gate definitions for a given trigger point."""
    config = _gate_config or load_gate_config()
    return [g for g in config.gates if g.trigger == trigger]


async def execute_gate(gate: GateDefinition, request: GateRequest) -> GateResult:
    """Execute a single gate check by calling its APIM endpoint.

    Handles timeouts according to the gate's on_timeout setting:
      - 'warn': return a warning result (operator can proceed with override)
      - 'fail': return a hard failure (blocks workflow)
      - 'pass': return a pass result (ignore timeout)
    """
    timeout = gate.timeout_ms / 1000.0
    url = f"{settings.apim_base_url}{gate.endpoint}"
    headers = {}
    if settings.apim_subscription_key:
        headers["Ocp-Apim-Subscription-Key"] = settings.apim_subscription_key

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method=gate.method,
                url=url,
                json=request.model_dump(),
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

            return GateResult(
                gate_id=gate.id,
                result=data.get("result", "pass"),
                checks=[GateCheckDetail(**c) for c in data.get("checks", [])],
                allow_override=data.get("allow_override", gate.allow_override),
                override_role=data.get("override_role", gate.override_role),
            )

    except httpx.TimeoutException:
        logger.warning("Gate %s timed out after %dms", gate.id, gate.timeout_ms)
        return GateResult(
            gate_id=gate.id,
            result=gate.on_timeout,
            checks=[
                GateCheckDetail(
                    check="timeout",
                    result=gate.on_timeout,
                    message=f"Gate check timed out after {gate.timeout_ms}ms",
                )
            ],
            allow_override=gate.allow_override,
            override_role=gate.override_role,
        )

    except httpx.HTTPError as e:
        logger.error("Gate %s HTTP error: %s", gate.id, str(e))
        return GateResult(
            gate_id=gate.id,
            result="fail",
            checks=[
                GateCheckDetail(
                    check="connection_error",
                    result="fail",
                    message=f"Gate check failed: {str(e)}",
                )
            ],
            allow_override=gate.allow_override,
            override_role=gate.override_role,
        )


async def run_gates(trigger: str, request: GateRequest) -> dict[str, GateResult]:
    """Run all gates for a trigger point. Returns {gate_id: GateResult}."""
    gates = get_gates_for_trigger(trigger)
    results = {}

    for gate in gates:
        result = await execute_gate(gate, request)
        results[gate.id] = result
        logger.info(
            "Gate %s result: %s",
            gate.id,
            result.result,
            extra={"gate_id": gate.id, "trigger": trigger},
        )

        # If a required gate hard-fails, stop processing further gates
        if gate.required and result.result == "fail":
            break

    return results
