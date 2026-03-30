# LLM Client for AlchemyAI / Gale Relay

This module provides a centralized Python client for interacting with the AlchemyAI / Gale relay service, which offers an OpenAI-compatible API routing to multiple AI models (GPT, Claude, Gemini, Sonar).

## Installation

```bash
pip install -r requirements.txt
```

## Configuration

Set the required environment variables:

```bash
export ALCHEMY_API_KEY="your-jwt-token-here"
# Optional: Override the default relay URL
export ALCHEMY_RELAY_BASE_URL="https://relay.ai.gale.technology/api/relay/openai/v1"
```

Or copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your credentials
```

## Usage

### Simple One-shot Chat

```python
from llm_client import chat

response = chat("Summarize this quarter's results.")
print(response)
```

### Streaming Chat

```python
from llm_client import stream_chat

for chunk in stream_chat("Explain quantum computing."):
    print(chunk, end="", flush=True)
```

### Full Control with Client Instance

```python
from llm_client import RelayClient

client = RelayClient()

# Basic completion
response = client.complete("What is the meaning of life?")
print(response)

# Streaming with custom parameters
for chunk in client.stream(
    "Write a short poem about AI",
    model="gpt-5.4-2026-03-05",
    temperature=0.7,
    max_tokens=500
):
    print(chunk, end="", flush=True)

# Multi-turn conversation
messages = [
    {"role": "user", "content": "Remember that I love pizza."},
    {"role": "assistant", "content": "Got it! You're a pizza fan."},
    {"role": "user", "content": "What should I have for dinner?"}
]
response = client.complete(messages=messages)
print(response)
```

### Model Catalog

```python
from llm_client import list_models, validate_model

# List all available models
models = list_models()
for model in models:
    print(f"{model.id}: {model.display_name} ({model.status})")

# Filter models
gpt_models = list_models(family="gpt", chat_only=True)
fast_models = list_models(tier="fast")

# Validate a model before use
try:
    model_info = validate_model("gpt-5.4-2026-03-05")
    print(f"Using {model_info.display_name}")
except ValueError as e:
    print(f"Model error: {e}")
```

## Available Models

The client includes a catalog of tested relay models:

- **GPT Models**: gpt-5.4-2026-03-05 (working), others currently failing
- **Claude Models**: haiku, sonnet, opus variants (currently failing)
- **Gemini Models**: flash, thinking, pro variants (currently failing)  
- **Sonar Models**: fast, pro, reasoning variants (currently failing)

Model status is tracked and updated based on testing against the relay.

## Command Line Interface

The module includes a CLI for testing:

```bash
# List all models
python llm_client.py --list

# Simple chat
python llm_client.py "Hello, world!"

# Streaming chat
python llm_client.py --stream "Tell me a story"

# Use specific model
python llm_client.py --model gpt-5.4-2026-03-05 "What's new?"
```

## Error Handling

The client automatically retries on transient errors (network issues, rate limits) with exponential backoff. Failed models are marked in the catalog to prevent repeated attempts.

## Testing

Run the test script:

```bash
python test_llm_client.py
```

This will show available models and can test API calls if you have credentials configured.
