package promptkit

import (
	"fmt"
	"testing"
)

func TestHashToBucket_Deterministic(t *testing.T) {
	tests := []struct {
		seed        string
		bucketCount int
	}{
		{"user-123", 100},
		{"user-456", 100},
		{"session-abc", 50},
		{"", 10},
		{"a", 1},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("seed=%q_buckets=%d", tt.seed, tt.bucketCount), func(t *testing.T) {
			first := hashToBucket(tt.seed, tt.bucketCount)
			for i := 0; i < 100; i++ {
				got := hashToBucket(tt.seed, tt.bucketCount)
				if got != first {
					t.Errorf("non-deterministic: call %d returned %d, expected %d", i, got, first)
				}
			}
		})
	}
}

func TestHashToBucket_InRange(t *testing.T) {
	seeds := []string{"alpha", "beta", "gamma", "delta", "epsilon", "user-1", "user-9999"}
	for _, seed := range seeds {
		for _, bc := range []int{1, 2, 5, 10, 100, 1000} {
			got := hashToBucket(seed, bc)
			if got < 0 || got >= bc {
				t.Errorf("hashToBucket(%q, %d) = %d, out of range [0, %d)", seed, bc, got, bc)
			}
		}
	}
}

func TestHashToBucket_ZeroBuckets(t *testing.T) {
	got := hashToBucket("seed", 0)
	if got != 0 {
		t.Errorf("expected 0 for 0 buckets, got %d", got)
	}
}

func TestHashToBucket_Distribution(t *testing.T) {
	// Verify rough distribution across buckets — no single bucket should get
	// a hugely disproportionate share with many distinct seeds.
	const buckets = 10
	const numSeeds = 10000
	counts := make([]int, buckets)
	for i := 0; i < numSeeds; i++ {
		seed := fmt.Sprintf("user-%d", i)
		b := hashToBucket(seed, buckets)
		counts[b]++
	}
	expected := numSeeds / buckets // 1000
	for i, c := range counts {
		// Allow 40% deviation
		if c < expected*6/10 || c > expected*14/10 {
			t.Errorf("bucket %d has %d items, expected ~%d (distribution too skewed)", i, c, expected)
		}
	}
}

func TestSelectVariant_Basic(t *testing.T) {
	tests := []struct {
		name    string
		seed    string
		weights []int
	}{
		{"equal_weights", "user-123", []int{50, 50}},
		{"unequal_weights", "user-123", []int{80, 20}},
		{"three_variants", "user-456", []int{33, 33, 34}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idx := selectVariant(tt.seed, tt.weights)
			if idx < 0 || idx >= len(tt.weights) {
				t.Errorf("selectVariant returned %d, out of range [0, %d)", idx, len(tt.weights))
			}
		})
	}
}

func TestSelectVariant_Deterministic(t *testing.T) {
	seed := "test-user-42"
	weights := []int{50, 30, 20}
	first := selectVariant(seed, weights)
	for i := 0; i < 100; i++ {
		got := selectVariant(seed, weights)
		if got != first {
			t.Errorf("non-deterministic: call %d returned %d, expected %d", i, got, first)
		}
	}
}

func TestSelectVariant_SingleVariant(t *testing.T) {
	got := selectVariant("any-seed", []int{100})
	if got != 0 {
		t.Errorf("expected 0 for single variant, got %d", got)
	}
}

func TestSelectVariant_RespectsWeights(t *testing.T) {
	// With a very skewed distribution, most seeds should land in the heavy bucket.
	weights := []int{95, 5}
	count0 := 0
	count1 := 0
	for i := 0; i < 1000; i++ {
		seed := fmt.Sprintf("user-%d", i)
		idx := selectVariant(seed, weights)
		if idx == 0 {
			count0++
		} else {
			count1++
		}
	}
	// With 95/5 weights, variant 0 should get the vast majority
	if count0 < 800 {
		t.Errorf("variant 0 (weight 95) got only %d/1000 hits, expected >800", count0)
	}
	if count1 > 200 {
		t.Errorf("variant 1 (weight 5) got %d/1000 hits, expected <200", count1)
	}
}

func TestSelectVariant_EmptyWeights(t *testing.T) {
	got := selectVariant("seed", []int{})
	if got != 0 {
		t.Errorf("expected 0 for empty weights, got %d", got)
	}
}

func TestSelectVariant_ZeroWeights(t *testing.T) {
	got := selectVariant("seed", []int{0, 0})
	if got != 0 {
		t.Errorf("expected 0 for all-zero weights, got %d", got)
	}
}
