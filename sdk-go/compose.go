package promptkit

import (
	"fmt"
	"math"
	"math/rand"
	"regexp"
	"strings"
	"time"
)

// sdkVersion is the version of this Go SDK.
const sdkVersion = "0.1.0"

// variableRe matches {{word}} for template interpolation.
var variableRe = regexp.MustCompile(`\{\{(\w+)\}\}`)

// compose assembles a prompt locally from cached config.
// This mirrors the TypeScript compose function exactly.
func compose(config *SDKConfig, compositionName string, ctx ComposeContext) (*ComposeResult, error) {
	// Find composition by name
	var comp *CompositionConfig
	for i := range config.Compositions {
		if config.Compositions[i].Name == compositionName {
			comp = &config.Compositions[i]
			break
		}
	}
	if comp == nil {
		return nil, fmt.Errorf("composition %q not found", compositionName)
	}

	nodes := comp.Graph.Nodes
	edges := comp.Graph.Edges

	// Build lookup maps
	nodeMap := make(map[string]*GraphNode, len(nodes))
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	edgesBySource := make(map[string][]GraphEdge, len(edges))
	for _, edge := range edges {
		edgesBySource[edge.Source] = append(edgesBySource[edge.Source], edge)
	}

	// Enrich context with auto-captured metadata
	now := time.Now()
	fullContext := make(map[string]interface{})
	for k, v := range ctx {
		fullContext[k] = v
	}
	fullContext["_time"] = map[string]interface{}{
		"hour":      now.Hour(),
		"dayOfWeek": int(now.Weekday()),
		"date":      now.Format("2006-01-02"),
		"timestamp": now.Format(time.RFC3339),
	}
	fullContext["_env"] = map[string]interface{}{
		"name": config.Environment,
	}
	fullContext["_sdk"] = map[string]interface{}{
		"version":  sdkVersion,
		"language": "go",
	}
	if reqVal, ok := ctx["_request"]; ok {
		fullContext["_req"] = reqVal
	}

	var parts []string
	var resolvedBlocks []string

	// walk traverses the graph from a given node ID.
	var walk func(nodeID string)
	walk = func(nodeID string) {
		node, ok := nodeMap[nodeID]
		if !ok {
			return
		}

		switch node.Type {
		case "block":
			blockID, _ := node.Data["blockId"].(string)
			block, exists := config.Blocks[blockID]
			if exists {
				content := block.Content
				content = variableRe.ReplaceAllStringFunc(content, func(match string) string {
					key := match[2 : len(match)-2] // strip {{ and }}
					if val, ok := fullContext[key]; ok {
						return fmt.Sprintf("%v", val)
					}
					return match
				})
				parts = append(parts, content)
				resolvedBlocks = append(resolvedBlocks, block.Name)
			}

		case "ifBoolean":
			field, _ := node.Data["field"].(string)
			value := toBool(resolveContextPath(fullContext, field))
			handle := "false"
			if value {
				handle = "true"
			}
			for _, e := range edgesBySource[node.ID] {
				if e.SourceHandle == handle {
					walk(e.Target)
				}
			}
			return

		case "ifSwitch":
			field, _ := node.Data["field"].(string)
			rawValue := resolveContextPath(fullContext, field)
			value := fmt.Sprintf("%v", rawValue)
			cases := toStringSlice(node.Data["cases"])
			match := ""
			if len(cases) > 0 {
				match = cases[len(cases)-1] // default: last case
				for _, c := range cases {
					if c == value {
						match = value
						break
					}
				}
			}
			for _, e := range edgesBySource[node.ID] {
				if e.SourceHandle == match {
					walk(e.Target)
				}
			}
			return

		case "ifPercentage":
			variants := toVariants(node.Data["variants"])
			seed := getSeed(fullContext)
			weights := make([]int, len(variants))
			for i, v := range variants {
				weights[i] = v.weight
			}
			selectedIndex := selectVariant(seed, weights)
			if selectedIndex < len(variants) {
				selectedName := variants[selectedIndex].name
				for _, e := range edgesBySource[node.ID] {
					if e.SourceHandle == selectedName {
						walk(e.Target)
					}
				}
			}
			return

		case "ifExpression":
			expression, _ := node.Data["expression"].(string)
			value := evaluateExpression(expression, fullContext)
			handle := "false"
			if value {
				handle = "true"
			}
			for _, e := range edgesBySource[node.ID] {
				if e.SourceHandle == handle {
					walk(e.Target)
				}
			}
			return
		}

		// For start, merge, output, and any other passthrough nodes: follow all edges
		for _, e := range edgesBySource[node.ID] {
			walk(e.Target)
		}
	}

	// Find start node and begin walking
	for _, n := range nodes {
		if n.Type == "start" {
			walk(n.ID)
			break
		}
	}

	text := strings.Join(parts, "\n\n")

	// Generate assembly ID matching the TS pattern: asm_{timestamp}_{random6}
	id := fmt.Sprintf("asm_%d_%s", time.Now().UnixMilli(), randomString(6))

	return &ComposeResult{
		ID:              id,
		Text:            text,
		Version:         fmt.Sprintf("v%d", comp.Version),
		VariantID:       nil,
		TokenCount:      int(math.Round(float64(len(text)) / 4.0)),
		Blocks:          resolvedBlocks,
		CompositionName: compositionName,
	}, nil
}

// variant is a helper type for percentage-based routing.
type variant struct {
	name   string
	weight int
}

// toVariants extracts a slice of variants from a data field.
func toVariants(v interface{}) []variant {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	var result []variant
	for _, item := range arr {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := m["name"].(string)
		weight := toInt(m["weight"])
		result = append(result, variant{name: name, weight: weight})
	}
	return result
}

// toStringSlice extracts a string slice from an interface value.
func toStringSlice(v interface{}) []string {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	var result []string
	for _, item := range arr {
		s, ok := item.(string)
		if ok {
			result = append(result, s)
		}
	}
	return result
}

// toInt coerces an interface value to int.
func toInt(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case int64:
		return int(val)
	default:
		return 0
	}
}

// getSeed extracts a seed for percentage routing.
// Priority: _req.userId > _req.sessionId > current timestamp.
func getSeed(ctx map[string]interface{}) string {
	if req, ok := ctx["_req"]; ok {
		if m, ok := req.(map[string]interface{}); ok {
			if uid, ok := m["userId"].(string); ok && uid != "" {
				return uid
			}
			if sid, ok := m["sessionId"].(string); ok && sid != "" {
				return sid
			}
		}
	}
	return fmt.Sprintf("%d", time.Now().UnixMilli())
}

// randomString generates a random alphanumeric string of the given length.
func randomString(n int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}
