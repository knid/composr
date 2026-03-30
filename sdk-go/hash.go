package composr

// hashToBucket produces a deterministic bucket index from a seed string.
// This mirrors the TypeScript implementation: Java-style hashCode modulo bucketCount.
func hashToBucket(seed string, bucketCount int) int {
	if bucketCount <= 0 {
		return 0
	}
	hash := int32(0)
	for i := 0; i < len(seed); i++ {
		ch := int32(seed[i])
		hash = ((hash << 5) - hash) + ch
		// hash = hash & hash in JS is a no-op int32 truncation;
		// Go's int32 already wraps on overflow, so no extra step needed.
	}
	// JS Math.abs on int32 values: for most values -hash works, but
	// math.MinInt32 (-2147483648) cannot be negated in int32 — JS returns
	// 2147483648 as a float64. We use int64 to handle that correctly.
	abs := int64(hash)
	if abs < 0 {
		abs = -abs
	}
	return int(abs % int64(bucketCount))
}

// selectVariant picks a variant index based on a seed and a slice of weights.
// Same algorithm as the TypeScript SDK: sum weights, hash into that range,
// then walk the cumulative distribution.
func selectVariant(seed string, weights []int) int {
	if len(weights) == 0 {
		return 0
	}
	total := 0
	for _, w := range weights {
		total += w
	}
	if total == 0 {
		return 0
	}
	bucket := hashToBucket(seed, total)
	cumulative := 0
	for i, w := range weights {
		cumulative += w
		if bucket < cumulative {
			return i
		}
	}
	return len(weights) - 1
}
