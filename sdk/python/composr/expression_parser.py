"""
Safe expression evaluator — pure manual parsing.
Supports: ==, !=, >, <, >=, <=, &&, ||, !, parentheses, dot-path context lookups.
"""
from __future__ import annotations
from typing import Any


def _split_outside_parens(s: str, delimiter: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current = ""
    i = 0
    while i < len(s):
        if s[i] == "(":
            depth += 1
            current += s[i]
            i += 1
        elif s[i] == ")":
            depth -= 1
            current += s[i]
            i += 1
        elif depth == 0 and s[i:i + len(delimiter)] == delimiter:
            parts.append(current)
            current = ""
            i += len(delimiter)
        else:
            current += s[i]
            i += 1
    parts.append(current)
    return parts


def _resolve_value(token: str, context: dict[str, Any]) -> Any:
    t = token.strip()
    if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
        return t[1:-1]
    if t == "true":
        return True
    if t == "false":
        return False
    if t == "null":
        return None
    try:
        return int(t) if "." not in t else float(t)
    except ValueError:
        pass
    # Dot-path lookup
    current: Any = context
    for part in t.split("."):
        if current is None or not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _evaluate_comparison(expr: str, context: dict[str, Any]) -> bool:
    trimmed = expr.strip()
    for op in (">=", "<=", "!=", "==", ">", "<"):
        idx = trimmed.find(op)
        if idx != -1:
            left = _resolve_value(trimmed[:idx], context)
            right = _resolve_value(trimmed[idx + len(op):], context)
            if op == "==":
                return left == right
            if op == "!=":
                return left != right
            try:
                lv, rv = float(left), float(right)
            except (TypeError, ValueError):
                return False
            if op == ">=":
                return lv >= rv
            if op == "<=":
                return lv <= rv
            if op == ">":
                return lv > rv
            if op == "<":
                return lv < rv
    return bool(_resolve_value(trimmed, context))


def _evaluate_unit(expr: str, context: dict[str, Any]) -> bool:
    trimmed = expr.strip()
    if trimmed.startswith("!"):
        return not _evaluate_unit(trimmed[1:], context)
    if trimmed.startswith("(") and trimmed.endswith(")"):
        return evaluate_expression(trimmed[1:-1], context)
    return _evaluate_comparison(trimmed, context)


def evaluate_expression(expression: str, context: dict[str, Any]) -> bool:
    trimmed = expression.strip()
    if not trimmed:
        return False
    or_parts = _split_outside_parens(trimmed, "||")
    if len(or_parts) > 1:
        return any(evaluate_expression(p.strip(), context) for p in or_parts)
    and_parts = _split_outside_parens(trimmed, "&&")
    if len(and_parts) > 1:
        return all(evaluate_expression(p.strip(), context) for p in and_parts)
    return _evaluate_unit(trimmed, context)
