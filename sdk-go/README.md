# Composr Go SDK

The official Go SDK for [Composr](https://composr.dev) -- the prompt compiler for AI-first teams.

## Install

```bash
go get github.com/composr/sdk-go
```

## Usage

```go
package main

import (
    "fmt"
    "log"
    composr "github.com/composr/sdk-go"
)

func main() {
    pk := composr.New(composr.Config{
        APIKey:      "pk_live_...",
        Environment: "prod",
    })
    defer pk.Close()

    result, err := pk.Compose("builder", composr.ComposeContext{
        "projectType": "ecommerce",
        "hasAuth":     true,
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(result.Text)       // assembled prompt
    fmt.Println(result.TokenCount) // token estimate

    // Track LLM output for scoring
    pk.Track(result.ID, composr.TrackPayload{
        Input:     "user prompt here",
        Output:    "llm response here",
        Model:     "claude-sonnet-4.6",
        LatencyMs: 3200,
    })

    // Send manual metrics
    pk.Score(result.ID, map[string]interface{}{
        "accuracy":  0.95,
        "relevance": 0.88,
    })
}
```

## API

### `New(cfg Config) *Composr`

Creates a new client. Configuration options:

| Field | Type | Default | Description |
|---|---|---|---|
| `APIKey` | `string` | (required) | Your Composr API key |
| `Environment` | `string` | `"prod"` | Environment name |
| `BaseURL` | `string` | `"https://app.composr.dev"` | API base URL |
| `SyncIntervalMs` | `int` | `30000` | Background sync interval in ms |

### `Initialize() error`

Fetches config from the server and starts background sync. Called automatically by `Compose` if not called explicitly.

### `Compose(name string, ctx ComposeContext) (*ComposeResult, error)`

Assembles a prompt locally using cached config. Returns the assembled text, token count, block list, and a unique assembly ID.

### `Track(assemblyID string, payload TrackPayload) error`

Sends an LLM input/output pair to Composr for auto-scoring.

### `Score(assemblyID string, metrics map[string]interface{}) error`

Sends manual metrics for an assembly.

### `Close()`

Stops background config sync. Call when the client is no longer needed.
