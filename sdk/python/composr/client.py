from __future__ import annotations
import threading
from typing import Any

import httpx

from composr.types import ComposeResult, SDKConfig, TrackPayload
from composr.compose import compose as _compose


class Composr:
    def __init__(
        self,
        api_key: str,
        environment: str = "prod",
        base_url: str = "https://app.composr.dev",
        sync_interval_s: float = 30.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.environment = environment
        self.sync_interval = sync_interval_s
        self._config: SDKConfig | None = None
        self._timer: threading.Timer | None = None
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10.0,
        )

    def initialize(self) -> None:
        self._fetch_config()
        self._start_polling()

    def _fetch_config(self) -> None:
        res = self._client.get(f"{self.base_url}/api/sdk/config/{self.environment}")
        res.raise_for_status()
        data = res.json()
        self._config = SDKConfig(
            version=data["version"],
            environment=data["environment"],
            blocks=data["blocks"],
            compositions=data["compositions"],
        )

    def _start_polling(self) -> None:
        def poll() -> None:
            try:
                self._fetch_config()
            except Exception:
                pass
            self._timer = threading.Timer(self.sync_interval, poll)
            self._timer.daemon = True
            self._timer.start()

        self._timer = threading.Timer(self.sync_interval, poll)
        self._timer.daemon = True
        self._timer.start()

    def compose(self, name: str, context: dict[str, Any] | None = None) -> ComposeResult:
        if self._config is None:
            self.initialize()
        return _compose(self._config, name, context or {})  # type: ignore[arg-type]

    def track(self, assembly_id: str, payload: TrackPayload) -> None:
        body: dict[str, Any] = {"assemblyId": assembly_id, "input": payload.input, "output": payload.output}
        if payload.model:
            body["model"] = payload.model
        if payload.latency_ms is not None:
            body["latencyMs"] = payload.latency_ms
        if payload.composition_id:
            body["compositionId"] = payload.composition_id
        if payload.composition_version is not None:
            body["compositionVersion"] = payload.composition_version
        if payload.environment:
            body["environment"] = payload.environment
        if payload.variant_id is not None:
            body["variantId"] = payload.variant_id
        if payload.context is not None:
            body["context"] = payload.context
        if payload.resolved_blocks is not None:
            body["resolvedBlocks"] = payload.resolved_blocks
        if payload.token_count is not None:
            body["tokenCount"] = payload.token_count

        self._client.post(f"{self.base_url}/api/sdk/track", json=body)

    def score(self, assembly_id: str, metrics: dict[str, Any]) -> None:
        self._client.post(
            f"{self.base_url}/api/sdk/score",
            json={"assemblyId": assembly_id, "metrics": metrics},
        )

    def destroy(self) -> None:
        if self._timer:
            self._timer.cancel()
            self._timer = None
        self._client.close()
