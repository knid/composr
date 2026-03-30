package promptkit

import (
	"strings"
	"testing"
)

// testConfig returns a mock SDKConfig for testing.
func testConfig() *SDKConfig {
	return &SDKConfig{
		Version:     "1",
		Environment: "test",
		Blocks: map[string]BlockConfig{
			"blk-1": {Name: "system-role", Content: "You are a helpful assistant.", Version: 1},
			"blk-2": {Name: "user-context", Content: "The user is working on a {{projectType}} project.", Version: 1},
			"blk-3": {Name: "tone-formal", Content: "Use a formal, professional tone.", Version: 1},
			"blk-4": {Name: "tone-casual", Content: "Use a casual, friendly tone.", Version: 1},
			"blk-5": {Name: "lang-en", Content: "Respond in English.", Version: 1},
			"blk-6": {Name: "lang-es", Content: "Respond in Spanish.", Version: 1},
			"blk-7": {Name: "lang-fr", Content: "Respond in French.", Version: 1},
			"blk-8": {Name: "variant-a", Content: "This is variant A.", Version: 1},
			"blk-9": {Name: "variant-b", Content: "This is variant B.", Version: 1},
			"blk-10": {Name: "night-block", Content: "Good evening! Here is your nighttime prompt.", Version: 1},
			"blk-11": {Name: "day-block", Content: "Good day! Here is your daytime prompt.", Version: 1},
		},
		Compositions: []CompositionConfig{
			linearComposition(),
			interpolationComposition(),
			ifBooleanComposition(),
			ifSwitchComposition(),
			ifPercentageComposition(),
			ifExpressionComposition(),
		},
	}
}

func linearComposition() CompositionConfig {
	return CompositionConfig{
		ID:      "comp-1",
		Name:    "linear",
		Version: 1,
		Graph: Graph{
			Nodes: []GraphNode{
				{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
				{ID: "block-1", Type: "block", Data: map[string]interface{}{"blockId": "blk-1"}},
				{ID: "block-2", Type: "block", Data: map[string]interface{}{"blockId": "blk-3"}},
				{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
			},
			Edges: []GraphEdge{
				{ID: "e1", Source: "start-1", Target: "block-1"},
				{ID: "e2", Source: "block-1", Target: "block-2"},
				{ID: "e3", Source: "block-2", Target: "output-1"},
			},
		},
	}
}

func interpolationComposition() CompositionConfig {
	return CompositionConfig{
		ID:      "comp-2",
		Name:    "interpolation",
		Version: 2,
		Graph: Graph{
			Nodes: []GraphNode{
				{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
				{ID: "block-1", Type: "block", Data: map[string]interface{}{"blockId": "blk-2"}},
				{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
			},
			Edges: []GraphEdge{
				{ID: "e1", Source: "start-1", Target: "block-1"},
				{ID: "e2", Source: "block-1", Target: "output-1"},
			},
		},
	}
}

func ifBooleanComposition() CompositionConfig {
	return CompositionConfig{
		ID:      "comp-3",
		Name:    "if-boolean",
		Version: 1,
		Graph: Graph{
			Nodes: []GraphNode{
				{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
				{ID: "if-1", Type: "ifBoolean", Data: map[string]interface{}{"field": "isFormal"}},
				{ID: "block-formal", Type: "block", Data: map[string]interface{}{"blockId": "blk-3"}},
				{ID: "block-casual", Type: "block", Data: map[string]interface{}{"blockId": "blk-4"}},
				{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
			},
			Edges: []GraphEdge{
				{ID: "e1", Source: "start-1", Target: "if-1"},
				{ID: "e2", Source: "if-1", Target: "block-formal", SourceHandle: "true"},
				{ID: "e3", Source: "if-1", Target: "block-casual", SourceHandle: "false"},
				{ID: "e4", Source: "block-formal", Target: "output-1"},
				{ID: "e5", Source: "block-casual", Target: "output-1"},
			},
		},
	}
}

func ifSwitchComposition() CompositionConfig {
	return CompositionConfig{
		ID:      "comp-4",
		Name:    "if-switch",
		Version: 1,
		Graph: Graph{
			Nodes: []GraphNode{
				{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
				{ID: "switch-1", Type: "ifSwitch", Data: map[string]interface{}{
					"field": "language",
					"cases": []interface{}{"en", "es", "fr"},
				}},
				{ID: "block-en", Type: "block", Data: map[string]interface{}{"blockId": "blk-5"}},
				{ID: "block-es", Type: "block", Data: map[string]interface{}{"blockId": "blk-6"}},
				{ID: "block-fr", Type: "block", Data: map[string]interface{}{"blockId": "blk-7"}},
				{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
			},
			Edges: []GraphEdge{
				{ID: "e1", Source: "start-1", Target: "switch-1"},
				{ID: "e2", Source: "switch-1", Target: "block-en", SourceHandle: "en"},
				{ID: "e3", Source: "switch-1", Target: "block-es", SourceHandle: "es"},
				{ID: "e4", Source: "switch-1", Target: "block-fr", SourceHandle: "fr"},
				{ID: "e5", Source: "block-en", Target: "output-1"},
				{ID: "e6", Source: "block-es", Target: "output-1"},
				{ID: "e7", Source: "block-fr", Target: "output-1"},
			},
		},
	}
}

func ifPercentageComposition() CompositionConfig {
	return CompositionConfig{
		ID:      "comp-5",
		Name:    "if-percentage",
		Version: 1,
		Graph: Graph{
			Nodes: []GraphNode{
				{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
				{ID: "pct-1", Type: "ifPercentage", Data: map[string]interface{}{
					"variants": []interface{}{
						map[string]interface{}{"name": "variantA", "weight": 50.0},
						map[string]interface{}{"name": "variantB", "weight": 50.0},
					},
				}},
				{ID: "block-a", Type: "block", Data: map[string]interface{}{"blockId": "blk-8"}},
				{ID: "block-b", Type: "block", Data: map[string]interface{}{"blockId": "blk-9"}},
				{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
			},
			Edges: []GraphEdge{
				{ID: "e1", Source: "start-1", Target: "pct-1"},
				{ID: "e2", Source: "pct-1", Target: "block-a", SourceHandle: "variantA"},
				{ID: "e3", Source: "pct-1", Target: "block-b", SourceHandle: "variantB"},
				{ID: "e4", Source: "block-a", Target: "output-1"},
				{ID: "e5", Source: "block-b", Target: "output-1"},
			},
		},
	}
}

func ifExpressionComposition() CompositionConfig {
	return CompositionConfig{
		ID:      "comp-6",
		Name:    "if-expression",
		Version: 1,
		Graph: Graph{
			Nodes: []GraphNode{
				{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
				{ID: "expr-1", Type: "ifExpression", Data: map[string]interface{}{
					"expression": "_time.hour >= 18",
				}},
				{ID: "block-night", Type: "block", Data: map[string]interface{}{"blockId": "blk-10"}},
				{ID: "block-day", Type: "block", Data: map[string]interface{}{"blockId": "blk-11"}},
				{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
			},
			Edges: []GraphEdge{
				{ID: "e1", Source: "start-1", Target: "expr-1"},
				{ID: "e2", Source: "expr-1", Target: "block-night", SourceHandle: "true"},
				{ID: "e3", Source: "expr-1", Target: "block-day", SourceHandle: "false"},
				{ID: "e4", Source: "block-night", Target: "output-1"},
				{ID: "e5", Source: "block-day", Target: "output-1"},
			},
		},
	}
}

func TestCompose_LinearGraph(t *testing.T) {
	config := testConfig()
	result, err := compose(config, "linear", ComposeContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result.Text, "You are a helpful assistant.") {
		t.Error("expected text to contain first block content")
	}
	if !strings.Contains(result.Text, "Use a formal, professional tone.") {
		t.Error("expected text to contain second block content")
	}
	if len(result.Blocks) != 2 {
		t.Errorf("expected 2 blocks, got %d", len(result.Blocks))
	}
	if result.Blocks[0] != "system-role" {
		t.Errorf("expected first block 'system-role', got %q", result.Blocks[0])
	}
	if result.Blocks[1] != "tone-formal" {
		t.Errorf("expected second block 'tone-formal', got %q", result.Blocks[1])
	}
	if result.Version != "v1" {
		t.Errorf("expected version 'v1', got %q", result.Version)
	}
	if result.CompositionName != "linear" {
		t.Errorf("expected composition name 'linear', got %q", result.CompositionName)
	}
	if !strings.HasPrefix(result.ID, "asm_") {
		t.Errorf("expected ID to start with 'asm_', got %q", result.ID)
	}
	if result.TokenCount <= 0 {
		t.Error("expected positive token count")
	}
	if result.VariantID != nil {
		t.Errorf("expected nil variant ID, got %v", result.VariantID)
	}

	// Check two blocks joined by \n\n
	expected := "You are a helpful assistant.\n\nUse a formal, professional tone."
	if result.Text != expected {
		t.Errorf("text mismatch:\ngot:  %q\nwant: %q", result.Text, expected)
	}
}

func TestCompose_VariableInterpolation(t *testing.T) {
	config := testConfig()
	result, err := compose(config, "interpolation", ComposeContext{
		"projectType": "ecommerce",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result.Text, "ecommerce") {
		t.Errorf("expected interpolated text to contain 'ecommerce', got %q", result.Text)
	}
	expected := "The user is working on a ecommerce project."
	if result.Text != expected {
		t.Errorf("text mismatch:\ngot:  %q\nwant: %q", result.Text, expected)
	}
}

func TestCompose_VariableInterpolation_MissingVariable(t *testing.T) {
	config := testConfig()
	result, err := compose(config, "interpolation", ComposeContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Missing variable should remain as {{projectType}}
	if !strings.Contains(result.Text, "{{projectType}}") {
		t.Errorf("expected unreplaced variable placeholder, got %q", result.Text)
	}
}

func TestCompose_IfBoolean_TrueBranch(t *testing.T) {
	config := testConfig()
	result, err := compose(config, "if-boolean", ComposeContext{
		"isFormal": true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result.Text, "formal, professional tone") {
		t.Errorf("expected formal block, got %q", result.Text)
	}
	if strings.Contains(result.Text, "casual, friendly tone") {
		t.Error("should not contain casual block")
	}
}

func TestCompose_IfBoolean_FalseBranch(t *testing.T) {
	config := testConfig()
	result, err := compose(config, "if-boolean", ComposeContext{
		"isFormal": false,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result.Text, "casual, friendly tone") {
		t.Errorf("expected casual block, got %q", result.Text)
	}
	if strings.Contains(result.Text, "formal, professional tone") {
		t.Error("should not contain formal block")
	}
}

func TestCompose_IfSwitch_EachCase(t *testing.T) {
	config := testConfig()

	tests := []struct {
		language string
		expected string
	}{
		{"en", "Respond in English."},
		{"es", "Respond in Spanish."},
		{"fr", "Respond in French."},
	}

	for _, tt := range tests {
		t.Run("lang_"+tt.language, func(t *testing.T) {
			result, err := compose(config, "if-switch", ComposeContext{
				"language": tt.language,
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Text != tt.expected {
				t.Errorf("got %q, want %q", result.Text, tt.expected)
			}
		})
	}
}

func TestCompose_IfSwitch_DefaultFallback(t *testing.T) {
	config := testConfig()
	result, err := compose(config, "if-switch", ComposeContext{
		"language": "de", // not in cases
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should fall back to last case ("fr")
	if !strings.Contains(result.Text, "Respond in French.") {
		t.Errorf("expected default fallback to French, got %q", result.Text)
	}
}

func TestCompose_IfPercentage_DeterministicForSameSeed(t *testing.T) {
	config := testConfig()
	ctx := ComposeContext{
		"_request": map[string]interface{}{
			"userId": "user-42",
		},
	}

	first, err := compose(config, "if-percentage", ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Call 100 times with the same seed — must always produce the same result
	for i := 0; i < 100; i++ {
		result, err := compose(config, "if-percentage", ctx)
		if err != nil {
			t.Fatalf("unexpected error on iteration %d: %v", i, err)
		}
		if result.Text != first.Text {
			t.Fatalf("non-deterministic on iteration %d: got %q, want %q", i, result.Text, first.Text)
		}
	}
}

func TestCompose_IfPercentage_ProducesBothVariants(t *testing.T) {
	config := testConfig()
	seenA := false
	seenB := false

	// Try many seeds to ensure both variants are reachable
	for i := 0; i < 200; i++ {
		ctx := ComposeContext{
			"_request": map[string]interface{}{
				"userId": strings.Repeat("x", i) + "user",
			},
		}
		result, err := compose(config, "if-percentage", ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if strings.Contains(result.Text, "variant A") {
			seenA = true
		}
		if strings.Contains(result.Text, "variant B") {
			seenB = true
		}
		if seenA && seenB {
			break
		}
	}

	if !seenA {
		t.Error("variant A was never selected")
	}
	if !seenB {
		t.Error("variant B was never selected")
	}
}

func TestCompose_IfExpression(t *testing.T) {
	// The expression is "_time.hour >= 18" — we cannot easily control time in
	// compose(), but we can verify the result is one of the two expected blocks.
	config := testConfig()
	result, err := compose(config, "if-expression", ComposeContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	isNight := strings.Contains(result.Text, "Good evening")
	isDay := strings.Contains(result.Text, "Good day")
	if !isNight && !isDay {
		t.Errorf("expected night or day block, got %q", result.Text)
	}
	// Exactly one should be present
	if isNight && isDay {
		t.Error("both night and day blocks present")
	}
}

func TestCompose_UnknownComposition(t *testing.T) {
	config := testConfig()
	_, err := compose(config, "nonexistent", ComposeContext{})
	if err == nil {
		t.Fatal("expected error for unknown composition")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' error, got %q", err.Error())
	}
}

func TestCompose_EmptyGraph(t *testing.T) {
	config := &SDKConfig{
		Version:     "1",
		Environment: "test",
		Blocks:      map[string]BlockConfig{},
		Compositions: []CompositionConfig{
			{
				ID:      "comp-empty",
				Name:    "empty",
				Version: 1,
				Graph: Graph{
					Nodes: []GraphNode{
						{ID: "start-1", Type: "start", Data: map[string]interface{}{}},
						{ID: "output-1", Type: "output", Data: map[string]interface{}{}},
					},
					Edges: []GraphEdge{
						{ID: "e1", Source: "start-1", Target: "output-1"},
					},
				},
			},
		},
	}

	result, err := compose(config, "empty", ComposeContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != "" {
		t.Errorf("expected empty text, got %q", result.Text)
	}
	if len(result.Blocks) != 0 {
		t.Errorf("expected 0 blocks, got %d", len(result.Blocks))
	}
	if result.TokenCount != 0 {
		t.Errorf("expected token count 0, got %d", result.TokenCount)
	}
}

func TestCompose_TokenCount(t *testing.T) {
	// "You are a helpful assistant." is 29 chars. Math.round(29/4) = 7
	config := &SDKConfig{
		Version:     "1",
		Environment: "test",
		Blocks: map[string]BlockConfig{
			"blk-1": {Name: "block", Content: "You are a helpful assistant.", Version: 1},
		},
		Compositions: []CompositionConfig{
			{
				ID:      "comp-tc",
				Name:    "token-count",
				Version: 1,
				Graph: Graph{
					Nodes: []GraphNode{
						{ID: "s", Type: "start", Data: map[string]interface{}{}},
						{ID: "b", Type: "block", Data: map[string]interface{}{"blockId": "blk-1"}},
						{ID: "o", Type: "output", Data: map[string]interface{}{}},
					},
					Edges: []GraphEdge{
						{ID: "e1", Source: "s", Target: "b"},
						{ID: "e2", Source: "b", Target: "o"},
					},
				},
			},
		},
	}

	result, err := compose(config, "token-count", ComposeContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 29 / 4 = 7.25, Math.round(7.25) = 7
	if result.TokenCount != 7 {
		t.Errorf("expected token count 7, got %d (text len = %d)", result.TokenCount, len(result.Text))
	}
}

func TestCompose_MergeNode(t *testing.T) {
	// Test that merge nodes act as pass-through
	config := &SDKConfig{
		Version:     "1",
		Environment: "test",
		Blocks: map[string]BlockConfig{
			"blk-a": {Name: "alpha", Content: "Alpha content.", Version: 1},
			"blk-b": {Name: "beta", Content: "Beta content.", Version: 1},
		},
		Compositions: []CompositionConfig{
			{
				ID:      "comp-merge",
				Name:    "merge-test",
				Version: 1,
				Graph: Graph{
					Nodes: []GraphNode{
						{ID: "s", Type: "start", Data: map[string]interface{}{}},
						{ID: "b1", Type: "block", Data: map[string]interface{}{"blockId": "blk-a"}},
						{ID: "m", Type: "merge", Data: map[string]interface{}{}},
						{ID: "b2", Type: "block", Data: map[string]interface{}{"blockId": "blk-b"}},
						{ID: "o", Type: "output", Data: map[string]interface{}{}},
					},
					Edges: []GraphEdge{
						{ID: "e1", Source: "s", Target: "b1"},
						{ID: "e2", Source: "b1", Target: "m"},
						{ID: "e3", Source: "m", Target: "b2"},
						{ID: "e4", Source: "b2", Target: "o"},
					},
				},
			},
		},
	}

	result, err := compose(config, "merge-test", ComposeContext{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := "Alpha content.\n\nBeta content."
	if result.Text != expected {
		t.Errorf("got %q, want %q", result.Text, expected)
	}
}
