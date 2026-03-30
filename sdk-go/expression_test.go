package composr

import (
	"testing"
)

func TestEvaluateExpression(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		context    map[string]interface{}
		expected   bool
	}{
		// Empty expression
		{
			name:       "empty_expression",
			expression: "",
			context:    map[string]interface{}{},
			expected:   false,
		},
		{
			name:       "whitespace_expression",
			expression: "   ",
			context:    map[string]interface{}{},
			expected:   false,
		},

		// String comparison
		{
			name:       "string_equal_true",
			expression: `env == "production"`,
			context:    map[string]interface{}{"env": "production"},
			expected:   true,
		},
		{
			name:       "string_equal_false",
			expression: `env == "production"`,
			context:    map[string]interface{}{"env": "staging"},
			expected:   false,
		},
		{
			name:       "string_not_equal_true",
			expression: `env != "production"`,
			context:    map[string]interface{}{"env": "staging"},
			expected:   true,
		},
		{
			name:       "string_not_equal_false",
			expression: `env != "production"`,
			context:    map[string]interface{}{"env": "production"},
			expected:   false,
		},
		{
			name:       "single_quote_string",
			expression: `env == 'dev'`,
			context:    map[string]interface{}{"env": "dev"},
			expected:   true,
		},

		// Number comparison
		{
			name:       "number_greater_true",
			expression: "score > 50",
			context:    map[string]interface{}{"score": 75.0},
			expected:   true,
		},
		{
			name:       "number_greater_false",
			expression: "score > 50",
			context:    map[string]interface{}{"score": 30.0},
			expected:   false,
		},
		{
			name:       "number_less_true",
			expression: "age < 18",
			context:    map[string]interface{}{"age": 15.0},
			expected:   true,
		},
		{
			name:       "number_less_false",
			expression: "age < 18",
			context:    map[string]interface{}{"age": 25.0},
			expected:   false,
		},
		{
			name:       "number_gte_equal",
			expression: "count >= 10",
			context:    map[string]interface{}{"count": 10.0},
			expected:   true,
		},
		{
			name:       "number_gte_greater",
			expression: "count >= 10",
			context:    map[string]interface{}{"count": 15.0},
			expected:   true,
		},
		{
			name:       "number_lte_equal",
			expression: "count <= 10",
			context:    map[string]interface{}{"count": 10.0},
			expected:   true,
		},
		{
			name:       "number_equal",
			expression: "count == 10",
			context:    map[string]interface{}{"count": 10.0},
			expected:   true,
		},

		// Boolean comparison
		{
			name:       "bool_equal_true",
			expression: "active == true",
			context:    map[string]interface{}{"active": true},
			expected:   true,
		},
		{
			name:       "bool_equal_false",
			expression: "active == true",
			context:    map[string]interface{}{"active": false},
			expected:   false,
		},

		// Nested paths
		{
			name:       "nested_path_hour",
			expression: "_time.hour > 8",
			context: map[string]interface{}{
				"_time": map[string]interface{}{"hour": 14.0},
			},
			expected: true,
		},
		{
			name:       "nested_path_country",
			expression: `_req.country == "US"`,
			context: map[string]interface{}{
				"_req": map[string]interface{}{"country": "US"},
			},
			expected: true,
		},
		{
			name:       "nested_path_missing",
			expression: "_req.country == null",
			context:    map[string]interface{}{},
			expected:   true,
		},

		// Logical AND
		{
			name:       "and_both_true",
			expression: `env == "prod" && active == true`,
			context:    map[string]interface{}{"env": "prod", "active": true},
			expected:   true,
		},
		{
			name:       "and_one_false",
			expression: `env == "prod" && active == true`,
			context:    map[string]interface{}{"env": "prod", "active": false},
			expected:   false,
		},

		// Logical OR
		{
			name:       "or_one_true",
			expression: `env == "prod" || env == "staging"`,
			context:    map[string]interface{}{"env": "staging"},
			expected:   true,
		},
		{
			name:       "or_both_false",
			expression: `env == "prod" || env == "staging"`,
			context:    map[string]interface{}{"env": "dev"},
			expected:   false,
		},

		// NOT
		{
			name:       "not_true",
			expression: "!disabled",
			context:    map[string]interface{}{"disabled": false},
			expected:   true,
		},
		{
			name:       "not_false",
			expression: "!active",
			context:    map[string]interface{}{"active": true},
			expected:   false,
		},

		// Bare truthy
		{
			name:       "bare_truthy_true",
			expression: "enabled",
			context:    map[string]interface{}{"enabled": true},
			expected:   true,
		},
		{
			name:       "bare_truthy_false",
			expression: "enabled",
			context:    map[string]interface{}{"enabled": false},
			expected:   false,
		},
		{
			name:       "bare_truthy_string",
			expression: "name",
			context:    map[string]interface{}{"name": "Alice"},
			expected:   true,
		},
		{
			name:       "bare_truthy_empty_string",
			expression: "name",
			context:    map[string]interface{}{"name": ""},
			expected:   false,
		},
		{
			name:       "bare_truthy_number",
			expression: "count",
			context:    map[string]interface{}{"count": 42.0},
			expected:   true,
		},
		{
			name:       "bare_truthy_zero",
			expression: "count",
			context:    map[string]interface{}{"count": 0.0},
			expected:   false,
		},
		{
			name:       "bare_truthy_nil",
			expression: "missing",
			context:    map[string]interface{}{},
			expected:   false,
		},

		// Parentheses
		{
			name:       "parentheses_grouping",
			expression: `(env == "prod") && (active == true)`,
			context:    map[string]interface{}{"env": "prod", "active": true},
			expected:   true,
		},
		{
			name:       "complex_with_parens",
			expression: `(a > 5) && (b < 10 || c == "yes")`,
			context:    map[string]interface{}{"a": 8.0, "b": 12.0, "c": "yes"},
			expected:   true,
		},
		{
			name:       "complex_with_parens_false",
			expression: `(a > 5) && (b < 10 || c == "yes")`,
			context:    map[string]interface{}{"a": 3.0, "b": 12.0, "c": "yes"},
			expected:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateExpression(tt.expression, tt.context)
			if got != tt.expected {
				t.Errorf("evaluateExpression(%q) = %v, want %v", tt.expression, got, tt.expected)
			}
		})
	}
}

func TestResolveValue(t *testing.T) {
	ctx := map[string]interface{}{
		"name":  "Alice",
		"count": 42.0,
		"active": true,
		"nested": map[string]interface{}{
			"key": "deep-value",
		},
	}

	tests := []struct {
		name     string
		token    string
		expected interface{}
	}{
		{"double_quote_string", `"hello"`, "hello"},
		{"single_quote_string", `'world'`, "world"},
		{"bool_true", "true", true},
		{"bool_false", "false", false},
		{"null_literal", "null", nil},
		{"integer", "42", 42.0},
		{"negative_number", "-5", -5.0},
		{"float", "3.14", 3.14},
		{"context_string", "name", "Alice"},
		{"context_number", "count", 42.0},
		{"context_bool", "active", true},
		{"nested_path", "nested.key", "deep-value"},
		{"missing_key", "nonexistent", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveValue(tt.token, ctx)
			if got != tt.expected {
				t.Errorf("resolveValue(%q) = %v (%T), want %v (%T)", tt.token, got, got, tt.expected, tt.expected)
			}
		})
	}
}

func TestSplitOutsideParens(t *testing.T) {
	tests := []struct {
		name      string
		str       string
		delimiter string
		expected  []string
	}{
		{
			name:      "simple_split",
			str:       "a || b || c",
			delimiter: "||",
			expected:  []string{"a ", " b ", " c"},
		},
		{
			name:      "nested_parens",
			str:       "(a || b) && c",
			delimiter: "&&",
			expected:  []string{"(a || b) ", " c"},
		},
		{
			name:      "no_split",
			str:       "a && b",
			delimiter: "||",
			expected:  []string{"a && b"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := splitOutsideParens(tt.str, tt.delimiter)
			if len(got) != len(tt.expected) {
				t.Fatalf("got %d parts, want %d: %v", len(got), len(tt.expected), got)
			}
			for i, g := range got {
				if g != tt.expected[i] {
					t.Errorf("part[%d] = %q, want %q", i, g, tt.expected[i])
				}
			}
		})
	}
}
