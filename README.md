# ewpo

AI CLI + Telegram Bot — your personal AI assistant powered by OpenRouter.

## Usage

```bash
# Install
npm install
npm run build

# Commands
ewpo                     Interactive CLI chat
ewpo ask <question>      Ask a single question
ewpo telegram            Start Telegram bot mode
ewpo setup               Configure API keys
ewpo config              Show config
```

## Configuration

Edit `~/.config/ewpo-nodejs/config.json` or run `ewpo setup`.

Supports Anthropic, OpenAI, and OpenRouter providers.
