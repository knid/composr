package composr

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestNew_Defaults(t *testing.T) {
	pk := New(Config{APIKey: "pk_test_123"})
	defer pk.Close()

	if pk.apiKey != "pk_test_123" {
		t.Errorf("apiKey = %q, want %q", pk.apiKey, "pk_test_123")
	}
	if pk.environment != "prod" {
		t.Errorf("environment = %q, want %q", pk.environment, "prod")
	}
	if pk.baseURL != "https://app.composr.dev" {
		t.Errorf("baseURL = %q, want %q", pk.baseURL, "https://app.composr.dev")
	}
	if pk.syncInterval != 30*time.Second {
		t.Errorf("syncInterval = %v, want %v", pk.syncInterval, 30*time.Second)
	}
}

func TestNew_CustomConfig(t *testing.T) {
	pk := New(Config{
		APIKey:         "pk_test_456",
		Environment:    "staging",
		BaseURL:        "https://custom.api.dev",
		SyncIntervalMs: 5000,
	})
	defer pk.Close()

	if pk.environment != "staging" {
		t.Errorf("environment = %q, want %q", pk.environment, "staging")
	}
	if pk.baseURL != "https://custom.api.dev" {
		t.Errorf("baseURL = %q, want %q", pk.baseURL, "https://custom.api.dev")
	}
	if pk.syncInterval != 5*time.Second {
		t.Errorf("syncInterval = %v, want %v", pk.syncInterval, 5*time.Second)
	}
}

func TestInitialize_FetchesConfig(t *testing.T) {
	mockConfig := SDKConfig{
		Version:     "1",
		Environment: "test",
		Blocks: map[string]BlockConfig{
			"blk-1": {Name: "greeting", Content: "Hello!", Version: 1},
		},
		Compositions: []CompositionConfig{
			{
				ID:      "comp-1",
				Name:    "test-comp",
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

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer pk_test_init" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockConfig)
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:  "pk_test_init",
		BaseURL: server.URL,
	})
	defer pk.Close()

	if err := pk.Initialize(); err != nil {
		t.Fatalf("Initialize() error: %v", err)
	}

	pk.mu.RLock()
	if pk.config == nil {
		t.Fatal("config is nil after Initialize")
	}
	if pk.config.Version != "1" {
		t.Errorf("config version = %q, want %q", pk.config.Version, "1")
	}
	pk.mu.RUnlock()
}

func TestInitialize_AuthFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:  "bad-key",
		BaseURL: server.URL,
	})
	defer pk.Close()

	err := pk.Initialize()
	if err == nil {
		t.Fatal("expected error for unauthorized request")
	}
}

func TestCompose_AutoInitializes(t *testing.T) {
	mockConfig := SDKConfig{
		Version:     "1",
		Environment: "test",
		Blocks: map[string]BlockConfig{
			"blk-1": {Name: "greeting", Content: "Hello world!", Version: 1},
		},
		Compositions: []CompositionConfig{
			{
				ID:      "comp-1",
				Name:    "greet",
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

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockConfig)
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:  "pk_test",
		BaseURL: server.URL,
	})
	defer pk.Close()

	// Compose without calling Initialize — should auto-init
	result, err := pk.Compose("greet", ComposeContext{})
	if err != nil {
		t.Fatalf("Compose() error: %v", err)
	}
	if result.Text != "Hello world!" {
		t.Errorf("text = %q, want %q", result.Text, "Hello world!")
	}
}

func TestTrack(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/track" {
			json.NewDecoder(r.Body).Decode(&receivedBody)
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:  "pk_test",
		BaseURL: server.URL,
	})
	defer pk.Close()

	err := pk.Track("asm_123", TrackPayload{
		Input:     "hello",
		Output:    "world",
		Model:     "claude-sonnet-4.6",
		LatencyMs: 1500,
	})
	if err != nil {
		t.Fatalf("Track() error: %v", err)
	}

	if receivedBody["assemblyId"] != "asm_123" {
		t.Errorf("assemblyId = %v, want %v", receivedBody["assemblyId"], "asm_123")
	}
	if receivedBody["input"] != "hello" {
		t.Errorf("input = %v, want %v", receivedBody["input"], "hello")
	}
	if receivedBody["output"] != "world" {
		t.Errorf("output = %v, want %v", receivedBody["output"], "world")
	}
	if receivedBody["model"] != "claude-sonnet-4.6" {
		t.Errorf("model = %v, want %v", receivedBody["model"], "claude-sonnet-4.6")
	}
	if receivedBody["latencyMs"] != 1500.0 {
		t.Errorf("latencyMs = %v, want %v", receivedBody["latencyMs"], 1500)
	}
}

func TestScore(t *testing.T) {
	var receivedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/sdk/score" {
			json.NewDecoder(r.Body).Decode(&receivedBody)
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:  "pk_test",
		BaseURL: server.URL,
	})
	defer pk.Close()

	err := pk.Score("asm_456", map[string]interface{}{
		"accuracy":  0.95,
		"relevance": 0.88,
	})
	if err != nil {
		t.Fatalf("Score() error: %v", err)
	}

	if receivedBody["assemblyId"] != "asm_456" {
		t.Errorf("assemblyId = %v, want %v", receivedBody["assemblyId"], "asm_456")
	}
	metrics, ok := receivedBody["metrics"].(map[string]interface{})
	if !ok {
		t.Fatal("metrics missing or wrong type")
	}
	if metrics["accuracy"] != 0.95 {
		t.Errorf("accuracy = %v, want %v", metrics["accuracy"], 0.95)
	}
}

func TestSyncLoop_StopsOnClose(t *testing.T) {
	var fetchCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fetchCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(SDKConfig{
			Version:      "1",
			Environment:  "test",
			Blocks:       map[string]BlockConfig{},
			Compositions: []CompositionConfig{},
		})
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:         "pk_test",
		BaseURL:        server.URL,
		SyncIntervalMs: 50, // very short for testing
	})

	if err := pk.Initialize(); err != nil {
		t.Fatalf("Initialize() error: %v", err)
	}

	// Wait a bit to let at least one sync tick happen
	time.Sleep(120 * time.Millisecond)
	pk.Close()

	// After close, sync should stop
	countAfterClose := fetchCount.Load()
	time.Sleep(120 * time.Millisecond)
	countLater := fetchCount.Load()

	// At most one more fetch might sneak through
	if countLater > countAfterClose+1 {
		t.Errorf("sync continued after Close: count went from %d to %d", countAfterClose, countLater)
	}
}

func TestTrack_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	pk := New(Config{
		APIKey:  "pk_test",
		BaseURL: server.URL,
	})
	defer pk.Close()

	err := pk.Track("asm_123", TrackPayload{Input: "a", Output: "b"})
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
}
