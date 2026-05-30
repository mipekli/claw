# ewpo

AI CLI + Telegram Bot — personal AI assistant powered by Anthropic, OpenAI, or OpenRouter.

## Usage

```bash
# Install
npm install
npm run build
npm test

# Commands
ewpo                          Interactive CLI chat
ewpo ask <question>           Ask a single question
ewpo ask --file /tmp/p.txt    Ask using file content
ewpo telegram                 Start Telegram bot mode
ewpo setup                    Configure API keys
ewpo init                     First-time setup alias
ewpo config                   Show config
ewpo provider list            List providers
ewpo provider set openai      Set provider
ewpo model list               List known models for active provider
ewpo model set gpt-4o         Set active model
```

## CLI Commands

Inside interactive mode:

- `/clear` clear memory
- `/save <name>` save session history
- `/load <name>` load saved history
- `/history` list saved histories
- `/model <model>` change model
- `/provider <provider>` change provider
- `"""` start/finish multiline prompt
- `@/absolute/path/file.txt` read prompt from file

## Telegram Commands

- `/start`, `/help`, `/clear`
- `/status`
- `/admin_allow <id1,id2>` admin-only
- `/admin_deny <id1,id2>` admin-only

When `historyEnabled` is true, user chats are persisted.

## Configuration

Edit `~/.config/ewpo-nodejs/config.json` or run `ewpo setup`.

Supports Anthropic, OpenAI, and OpenRouter providers.

Optional environment loading is enabled via `.env`.

See `.env.example` for starter variables.
