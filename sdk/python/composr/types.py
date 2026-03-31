from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ModelConfig:
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    stop_sequences: list[str] | None = None


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class ComposeResult:
    id: str
    text: str
    version: str
    variant_id: str | None
    token_count: int
    blocks: list[str]
    composition_name: str
    messages: list[dict[str, Any]] = field(default_factory=list)
    model: str | None = None
    config: ModelConfig | None = None
    tools: list[ToolDefinition] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class TrackPayload:
    input: str
    output: str
    model: str | None = None
    latency_ms: int | None = None
    composition_id: str | None = None
    composition_version: int | None = None
    environment: str | None = None
    variant_id: str | None = None
    context: dict[str, Any] | None = None
    resolved_blocks: list[str] | None = None
    token_count: int | None = None


@dataclass
class SDKConfig:
    version: str
    environment: str
    blocks: dict[str, dict[str, Any]]
    compositions: list[dict[str, Any]]
