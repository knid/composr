from __future__ import annotations
import re
import time
import random
from typing import Any

from composr.types import ComposeResult, SDKConfig
from composr.hash import select_variant
from composr.expression_parser import evaluate_expression

SDK_VERSION = "0.1.0"


def compose(config: SDKConfig, composition_name: str, context: dict[str, Any] | None = None) -> ComposeResult:
    context = context or {}
    comp = next((c for c in config.compositions if c["name"] == composition_name), None)
    if not comp:
        raise ValueError(f'Composition "{composition_name}" not found')

    nodes = comp["graph"]["nodes"]
    edges = comp["graph"]["edges"]

    node_map = {n["id"]: n for n in nodes}
    edges_by_source: dict[str, list[dict]] = {}
    for edge in edges:
        edges_by_source.setdefault(edge["source"], []).append(edge)

    from datetime import datetime
    now = datetime.now()
    full_context: dict[str, Any] = {
        **context,
        "_time": {
            "hour": now.hour,
            "dayOfWeek": now.weekday(),
            "date": now.strftime("%Y-%m-%d"),
            "timestamp": now.isoformat(),
        },
        "_env": {"name": config.environment},
        "_sdk": {"version": SDK_VERSION, "language": "python"},
    }
    if "_request" in context:
        full_context["_req"] = context["_request"]

    parts: list[str] = []
    resolved_blocks: list[str] = []
    variant_id: str | None = None

    def resolve(ctx: dict[str, Any], path: str) -> Any:
        current: Any = ctx
        for part in path.split("."):
            if current is None or not isinstance(current, dict):
                return None
            current = current.get(part)
        return current

    def walk(node_id: str) -> None:
        node = node_map.get(node_id)
        if not node:
            return

        node_type = node.get("type", "")

        if node_type == "block":
            block_id = node["data"].get("blockId", "")
            block = config.blocks.get(block_id)
            if block:
                content = block["content"]
                content = re.sub(
                    r"\{\{(\w+)\}\}",
                    lambda m: str(full_context[m.group(1)]) if m.group(1) in full_context else m.group(0),
                    content,
                )
                parts.append(content)
                resolved_blocks.append(block["name"])

        elif node_type == "ifBoolean":
            value = bool(resolve(full_context, node["data"]["field"]))
            handle = "true" if value else "false"
            for e in edges_by_source.get(node_id, []):
                if e.get("sourceHandle") == handle:
                    walk(e["target"])
            return

        elif node_type == "ifSwitch":
            value = str(resolve(full_context, node["data"]["field"]))
            cases = node["data"].get("cases", [])
            match = value if value in cases else (cases[-1] if cases else None)
            if match:
                for e in edges_by_source.get(node_id, []):
                    if e.get("sourceHandle") == match:
                        walk(e["target"])
            return

        elif node_type == "ifPercentage":
            variants = node["data"].get("variants", [])
            seed = (full_context.get("_req", {}) or {}).get("userId") or \
                   (full_context.get("_req", {}) or {}).get("sessionId") or \
                   str(int(time.time() * 1000))
            weights = [v["weight"] for v in variants]
            if weights:
                idx = select_variant(seed, weights)
                selected = variants[idx]
                nonlocal variant_id
                variant_id = selected["name"]
                for e in edges_by_source.get(node_id, []):
                    if e.get("sourceHandle") == selected["name"]:
                        walk(e["target"])
            return

        elif node_type == "ifExpression":
            expression = node["data"].get("expression", "")
            value = evaluate_expression(expression, full_context)
            handle = "true" if value else "false"
            for e in edges_by_source.get(node_id, []):
                if e.get("sourceHandle") == handle:
                    walk(e["target"])
            return

        elif node_type == "output":
            return

        # Follow all outgoing edges for non-IF nodes
        for e in edges_by_source.get(node_id, []):
            walk(e["target"])

    start = next((n for n in nodes if n.get("type") == "start"), None)
    if start:
        walk(start["id"])

    text = "\n\n".join(parts)
    rand_suffix = hex(random.randint(0, 0xFFFFFF))[2:]
    return ComposeResult(
        id=f"asm_{int(time.time())}_{rand_suffix}",
        text=text,
        version=f"v{comp['version']}",
        variant_id=variant_id,
        token_count=len(text) // 4,
        blocks=resolved_blocks,
        composition_name=composition_name,
    )
