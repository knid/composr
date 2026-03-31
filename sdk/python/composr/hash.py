def hash_to_bucket(seed: str, bucket_count: int) -> int:
    h = 0
    for ch in seed:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF  # 32-bit
    # Convert to signed 32-bit
    if h >= 0x80000000:
        h -= 0x100000000
    return abs(h) % bucket_count


def select_variant(seed: str, weights: list[int]) -> int:
    total = sum(weights)
    if total == 0:
        return 0
    bucket = hash_to_bucket(seed, total)
    cumulative = 0
    for i, w in enumerate(weights):
        cumulative += w
        if bucket < cumulative:
            return i
    return len(weights) - 1
