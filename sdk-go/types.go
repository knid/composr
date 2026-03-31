package composr

// Config holds initialization options for the Composr client.
type Config struct {
	APIKey         string
	Environment    string // "dev", "staging", "prod" (default: "prod")
	BaseURL        string // default: "https://app.composr.dev"
	SyncIntervalMs int    // default: 30000
	UseSSE         bool   // default: false
}

// ComposeContext is the context passed to Compose.
type ComposeContext map[string]interface{}

// Message represents a single message with a role (system, user, assistant).
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ModelConfig holds model-specific configuration parameters.
type ModelConfig struct {
	Temperature   *float64 `json:"temperature,omitempty"`
	MaxTokens     *int     `json:"maxTokens,omitempty"`
	TopP          *float64 `json:"topP,omitempty"`
	StopSequences []string `json:"stopSequences,omitempty"`
}

// ToolDefinition describes a tool/function that the model can call.
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

// ComposeResult is returned by Compose.
type ComposeResult struct {
	ID              string           `json:"id"`
	Text            string           `json:"text"`
	Messages        []Message        `json:"messages"`
	Model           string           `json:"model"`
	Config          *ModelConfig     `json:"config"`
	Tools           []ToolDefinition `json:"tools"`
	Version         string           `json:"version"`
	VariantID       *string          `json:"variant_id"`
	TokenCount      int              `json:"token_count"`
	Blocks          []string         `json:"blocks"`
	CompositionName string           `json:"composition_name"`
	Errors          []string         `json:"errors,omitempty"`
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
	Name        string `json:"name"`
	Content     string `json:"content"`
	Version     int    `json:"version"`
	Role        string `json:"role,omitempty"`
	Kind        string `json:"kind,omitempty"`
	Description string `json:"description,omitempty"`
}

// CompositionConfig represents a single composition with its graph.
type CompositionConfig struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Version       int                    `json:"version"`
	Graph         Graph                  `json:"graph"`
	ContextSchema []interface{}          `json:"context_schema"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
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
