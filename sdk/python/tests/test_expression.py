from composr.expression_parser import evaluate_expression


def test_boolean_true():
    assert evaluate_expression("hasAuth", {"hasAuth": True}) is True


def test_boolean_false():
    assert evaluate_expression("hasAuth", {"hasAuth": False}) is False


def test_comparison():
    assert evaluate_expression("_time.hour >= 18", {"_time": {"hour": 20}}) is True
    assert evaluate_expression("_time.hour >= 18", {"_time": {"hour": 10}}) is False


def test_equality():
    assert evaluate_expression('role == "admin"', {"role": "admin"}) is True
    assert evaluate_expression('role == "admin"', {"role": "user"}) is False


def test_and():
    ctx = {"a": True, "b": True}
    assert evaluate_expression("a && b", ctx) is True
    ctx["b"] = False
    assert evaluate_expression("a && b", ctx) is False


def test_or():
    ctx = {"a": False, "b": True}
    assert evaluate_expression("a || b", ctx) is True


def test_not():
    assert evaluate_expression("!hasAuth", {"hasAuth": False}) is True
    assert evaluate_expression("!hasAuth", {"hasAuth": True}) is False


def test_empty_expression():
    assert evaluate_expression("", {}) is False
