// Package promptkit provides the official Go SDK for PromptKit — the prompt
// compiler for AI-first teams.
//
// It connects to the PromptKit API, syncs composition config in the background,
// and assembles prompts locally using a graph-walking engine.
package promptkit

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// PromptKit is the main SDK client. It manages config sync and provides
// methods to compose prompts, track LLM outputs, and send manual scores.
type PromptKit struct {
	apiKey       string
	baseURL      string
	environment  string
	syncInterval time.Duration
	config       *SDKConfig
	mu           sync.RWMutex
	stopCh       chan struct{}
	httpClient   *http.Client
}

// New creates a new PromptKit client with the given configuration.
// Call Initialize to fetch config and start background sync, or simply
// call Compose which will auto-initialize on first use.
func New(cfg Config) *PromptKit {
	if cfg.Environment == "" {
		cfg.Environment = "prod"
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://app.promptkit.dev"
	}
	interval := time.Duration(cfg.SyncIntervalMs) * time.Millisecond
	if interval == 0 {
		interval = 30 * time.Second
	}
	return &PromptKit{
		apiKey:       cfg.APIKey,
		baseURL:      cfg.BaseURL,
		environment:  cfg.Environment,
		syncInterval: interval,
		stopCh:       make(chan struct{}),
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Initialize fetches the config from the server and starts background sync.
func (pk *PromptKit) Initialize() error {
	if err := pk.fetchConfig(); err != nil {
		return err
	}
	go pk.syncLoop()
	return nil
}

func (pk *PromptKit) fetchConfig() error {
	url := fmt.Sprintf("%s/api/sdk/config/%s", pk.baseURL, pk.environment)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+pk.apiKey)

	resp, err := pk.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("promptkit: config fetch failed (%d)", resp.StatusCode)
	}

	var config SDKConfig
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return err
	}

	pk.mu.Lock()
	pk.config = &config
	pk.mu.Unlock()
	return nil
}

func (pk *PromptKit) syncLoop() {
	ticker := time.NewTicker(pk.syncInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			_ = pk.fetchConfig()
		case <-pk.stopCh:
			return
		}
	}
}

// Compose assembles a prompt locally from cached config. If the client has
// not been initialized yet, it will auto-initialize on the first call.
func (pk *PromptKit) Compose(name string, ctx ComposeContext) (*ComposeResult, error) {
	pk.mu.RLock()
	config := pk.config
	pk.mu.RUnlock()

	if config == nil {
		if err := pk.Initialize(); err != nil {
			return nil, err
		}
		pk.mu.RLock()
		config = pk.config
		pk.mu.RUnlock()
	}

	return compose(config, name, ctx)
}

// Track sends an LLM input/output pair to PromptKit for auto-scoring.
func (pk *PromptKit) Track(assemblyID string, payload TrackPayload) error {
	body := map[string]interface{}{
		"assemblyId": assemblyID,
		"input":      payload.Input,
		"output":     payload.Output,
	}
	if payload.Model != "" {
		body["model"] = payload.Model
	}
	if payload.LatencyMs > 0 {
		body["latencyMs"] = payload.LatencyMs
	}

	return pk.post("/api/sdk/track", body)
}

// Score sends manual metrics for an assembly to PromptKit.
func (pk *PromptKit) Score(assemblyID string, metrics map[string]interface{}) error {
	return pk.post("/api/sdk/score", map[string]interface{}{
		"assemblyId": assemblyID,
		"metrics":    metrics,
	})
}

// Close stops background config sync. Should be called when the client is
// no longer needed.
func (pk *PromptKit) Close() {
	close(pk.stopCh)
}

func (pk *PromptKit) post(path string, body interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", pk.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+pk.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := pk.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("promptkit: request failed (%d)", resp.StatusCode)
	}
	return nil
}
