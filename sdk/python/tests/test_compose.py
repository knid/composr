import pytest
from composr.compose import compose
from composr.types import SDKConfig

MOCK_CONFIG = SDKConfig(
    version="1",
    environment="prod",
    blocks={
        "block-role": {"name": "role", "content": "You are a senior engineer.", "version": 1},
        "block-design": {"name": "design", "content": "Design philosophy for {{projectType}}.", "version": 1},
        "block-auth": {"name": "auth-rules", "content": "JWT auth with bcrypt.", "version": 1},
    },
    compositions=[
        {
            "id": "comp-1",
            "name": "builder",
            "version": 3,
            "contextSchema": [],
            "graph": {
                "nodes": [
                    {"id": "start", "type": "start", "data": {}},
                    {"id": "n-role", "type": "block", "data": {"blockId": "block-role"}},
                    {"id": "n-design", "type": "block", "data": {"blockId": "block-design"}},
                    {"id": "if-auth", "type": "ifBoolean", "data": {"field": "hasAuth"}},
                    {"id": "n-auth", "type": "block", "data": {"blockId": "block-auth"}},
                    {"id": "merge-1", "type": "merge", "data": {}},
                    {"id": "output", "type": "output", "data": {}},
                ],
                "edges": [
                    {"id": "e1", "source": "start", "target": "n-role"},
                    {"id": "e2", "source": "n-role", "target": "n-design"},
                    {"id": "e3", "source": "n-design", "target": "if-auth"},
                    {"id": "e4", "source": "if-auth", "target": "n-auth", "sourceHandle": "true"},
                    {"id": "e5", "source": "if-auth", "target": "merge-1", "sourceHandle": "false"},
                    {"id": "e6", "source": "n-auth", "target": "merge-1"},
                    {"id": "e7", "source": "merge-1", "target": "output"},
                ],
            },
        },
    ],
)


def test_assembles_blocks_in_order():
    result = compose(MOCK_CONFIG, "builder", {"projectType": "web", "hasAuth": False})
    assert result.blocks == ["role", "design"]
    assert "senior engineer" in result.text
    assert "Design philosophy for web" in result.text
    assert "JWT" not in result.text


def test_includes_conditional_block():
    result = compose(MOCK_CONFIG, "builder", {"projectType": "web", "hasAuth": True})
    assert result.blocks == ["role", "design", "auth-rules"]
    assert "JWT auth" in result.text


def test_interpolates_variables():
    result = compose(MOCK_CONFIG, "builder", {"projectType": "mobile", "hasAuth": False})
    assert "Design philosophy for mobile" in result.text


def test_returns_metadata():
    result = compose(MOCK_CONFIG, "builder", {"projectType": "web", "hasAuth": False})
    assert result.id.startswith("asm_")
    assert result.version == "v3"
    assert result.composition_name == "builder"
    assert result.token_count > 0


def test_throws_for_unknown_composition():
    with pytest.raises(ValueError, match="not found"):
        compose(MOCK_CONFIG, "nonexistent", {})
