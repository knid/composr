from composr.hash import hash_to_bucket, select_variant


def test_consistent_bucket():
    a = hash_to_bucket("user123", 100)
    b = hash_to_bucket("user123", 100)
    assert a == b


def test_different_seeds_different_buckets():
    a = hash_to_bucket("user_a", 1000)
    b = hash_to_bucket("user_b", 1000)
    assert a != b


def test_select_variant_respects_weights():
    # With deterministic seed, should always select the same variant
    idx1 = select_variant("test_user", [50, 50])
    idx2 = select_variant("test_user", [50, 50])
    assert idx1 == idx2
    assert idx1 in (0, 1)


def test_select_variant_100_percent():
    idx = select_variant("any_seed", [100])
    assert idx == 0
