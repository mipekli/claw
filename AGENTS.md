# ewpo - AI CLI + Telegram Bot

Proje yolu: `/root/openclaw/`

## Özellikler
- CLI interactive chat + Telegram bot
- Provider'lar: Anthropic (Claude), OpenAI (GPT-4o), OpenRouter
- Streaming yanıtlar, konuşma geçmişi, metrikler

## Komutlar
- `ewpo setup` — ilk kurulum
- `ewpo` — CLI sohbet
- `ewpo ask <soru> [--file <path>]` — tek soru
- `ewpo telegram` — Telegram botu başlat
- `ewpo config` — mevcut config
- `ewpo provider list|set <name>`
- `ewpo model list|set <name>`

## Build & Çalıştırma
```bash
npm run build    # tsc
npm run dev      # tsx ile direkt çalıştır
npm start        # node dist/index.js
npm test         # vitest
```

## Config
`~/.config/ewpo-nodejs/` altında `conf` kütüphanesi ile saklanır.
`.env` dosyasından da API key'ler okunur (dotenv).

## Proje Yapısı
- `src/index.ts` — giriş noktası, routing
- `src/telegram.ts` — Telegram bot (Telegraf)
- `src/cli.ts` — CLI interactive chat
- `src/config.ts` — config yönetimi
- `src/providers/` — Anthropic + OpenAI provider
- `src/history.ts` — geçmiş kaydetme/yükleme
- `src/metrics.ts` — kullanım metrikleri
