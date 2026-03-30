package promptkit

// Config holds initialization options for the PromptKit client.
type Config struct {
	APIKey         string
	Environment    string // "dev", "staging", "prod" (default: "prod")
	BaseURL        string // default: "https://app.promptkit.dev"
	SyncIntervalMs int    // default: 30000
}

// ComposeContext is the context passed to Compose.
type ComposeContext map[string]interface{}

// ComposeResult is returned by Compose.
type ComposeResult struct {
	ID              string   `json:"id"`
	Text            string   `json:"text"`
	Version         string   `json:"version"`
	VariantID       *string  `json:"variant_id"`
	TokenCount      int      `json:"token_count"`
	Blocks          []string `json:"blocks"`
	CompositionName string   `json:"composition_name"`
}

// TrackPayload is sent to the track endpoint.
type TrackPayload struct {
	Input     string `json:"input"`
	Output    string `json:"output"`
	Model     string `json:"model,omitempty"`
	LatencyMs int    `json:"latency_ms,omitempty"`
}

// SDKConfig is the config payload from the server.
type SDKConfig struct {
	Version      string                 `json:"version"`
	Environment  string                 `json:"environment"`
	Blocks       map[string]BlockConfig `json:"blocks"`
	Compositions []CompositionConfig    `json:"compositions"`
}

// BlockConfig represents a single prompt block.
type BlockConfig struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Version int    `json:"version"`
}

// CompositionConfig represents a single composition with its graph.
type CompositionConfig struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Version       int           `json:"version"`
	Graph         Graph         `json:"graph"`
	ContextSchema []interface{} `json:"context_schema"`
}

// Graph holds the nodes and edges of a composition graph.
type Graph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// GraphNode represents a single node in the composition graph.
type GraphNode struct {
	ID   string                 `json:"id"`
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

// GraphEdge represents a directed edge between two nodes.
type GraphEdge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"`
}
