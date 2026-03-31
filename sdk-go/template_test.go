package composr

import (
	"testing"
)

func TestRenderTemplate_SimpleVar(t *testing.T) {
	result := renderTemplate("Hello {{name}}", map[string]interface{}{"name": "World"})
	if result != "Hello World" {
		t.Errorf("expected 'Hello World', got %q", result)
	}
}

func TestRenderTemplate_DotPath(t *testing.T) {
	ctx := map[string]interface{}{
		"user": map[string]interface{}{"tier": "gold"},
	}
	result := renderTemplate("Tier: {{user.tier}}", ctx)
	if result != "Tier: gold" {
		t.Errorf("expected 'Tier: gold', got %q", result)
	}
}

func TestRenderTemplate_MissingVar(t *testing.T) {
	result := renderTemplate("Hello {{missing}}", map[string]interface{}{})
	if result != "Hello {{missing}}" {
		t.Errorf("expected 'Hello {{missing}}', got %q", result)
	}
}

func TestRenderTemplate_Default(t *testing.T) {
	result := renderTemplate(`{{role | default: "assistant"}}`, map[string]interface{}{})
	if result != "assistant" {
		t.Errorf("expected 'assistant', got %q", result)
	}
}

func TestRenderTemplate_DefaultIgnoredWhenPresent(t *testing.T) {
	result := renderTemplate(`{{role | default: "assistant"}}`, map[string]interface{}{"role": "admin"})
	if result != "admin" {
		t.Errorf("expected 'admin', got %q", result)
	}
}

func TestRenderTemplate_IfTrue(t *testing.T) {
	result := renderTemplate("{{#if isAdmin}}Admin{{/if}}", map[string]interface{}{"isAdmin": true})
	if result != "Admin" {
		t.Errorf("expected 'Admin', got %q", result)
	}
}

func TestRenderTemplate_IfFalse(t *testing.T) {
	result := renderTemplate("{{#if isAdmin}}Admin{{/if}}", map[string]interface{}{"isAdmin": false})
	if result != "" {
		t.Errorf("expected '', got %q", result)
	}
}

func TestRenderTemplate_IfElse(t *testing.T) {
	result := renderTemplate("{{#if isAdmin}}Admin{{else}}User{{/if}}", map[string]interface{}{"isAdmin": false})
	if result != "User" {
		t.Errorf("expected 'User', got %q", result)
	}
}

func TestRenderTemplate_Unless(t *testing.T) {
	result := renderTemplate("{{#unless isAdmin}}Restricted{{/unless}}", map[string]interface{}{"isAdmin": false})
	if result != "Restricted" {
		t.Errorf("expected 'Restricted', got %q", result)
	}
}

func TestRenderTemplate_EachArray(t *testing.T) {
	ctx := map[string]interface{}{
		"items": []interface{}{"A", "B", "C"},
	}
	result := renderTemplate("{{#each items}}{{this}} {{/each}}", ctx)
	if result != "A B C " {
		t.Errorf("expected 'A B C ', got %q", result)
	}
}

func TestRenderTemplate_EachObjects(t *testing.T) {
	ctx := map[string]interface{}{
		"methods": []interface{}{
			map[string]interface{}{"name": "Camera"},
			map[string]interface{}{"name": "GPS"},
		},
	}
	result := renderTemplate("{{#each methods}}{{name}}, {{/each}}", ctx)
	if result != "Camera, GPS, " {
		t.Errorf("expected 'Camera, GPS, ', got %q", result)
	}
}

func TestRenderTemplate_NestedIfInEach(t *testing.T) {
	ctx := map[string]interface{}{
		"methods": []interface{}{
			map[string]interface{}{"name": "camera", "enabled": true},
			map[string]interface{}{"name": "gps", "enabled": false},
			map[string]interface{}{"name": "storage", "enabled": true},
		},
	}
	result := renderTemplate("{{#each methods}}{{#if enabled}}{{name}} {{/if}}{{/each}}", ctx)
	if result != "camera storage " {
		t.Errorf("expected 'camera storage ', got %q", result)
	}
}

func TestRenderTemplate_NoTags(t *testing.T) {
	result := renderTemplate("Hello World", map[string]interface{}{})
	if result != "Hello World" {
		t.Errorf("expected 'Hello World', got %q", result)
	}
}

func TestRenderTemplate_EmptyArray(t *testing.T) {
	ctx := map[string]interface{}{
		"items": []interface{}{},
	}
	result := renderTemplate("{{#if items}}Has{{/if}}", ctx)
	if result != "" {
		t.Errorf("expected '', got %q (empty array should be falsy)", result)
	}
}

func TestRenderTemplate_DotPathDefault(t *testing.T) {
	result := renderTemplate(`{{user.role | default: "guest"}}`, map[string]interface{}{})
	if result != "guest" {
		t.Errorf("expected 'guest', got %q", result)
	}
}
