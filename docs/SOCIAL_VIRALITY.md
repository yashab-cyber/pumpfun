# 🌐 Autonomous Social Sentiment & Virality Scraper

## 1. Overview

Memecoin prices on Pump.fun are heavily driven by cultural momentum, ticker meta relevance, and community distribution channels. The **Social Sentiment Analyzer** (`socialSentiment.ts`) scores incoming tokens before execution.

---

## 2. Virality Scoring Components

```
[Token Creation Event]
         │
         ├──────────────────────────────────────────┐
         ▼                                          ▼
[Channel Verification]                     [Meta Keyword Matcher]
• Twitter Link (+30pts)                    • pepe, doge, wojak, cult
• Telegram Link (+15pts)                   • chad, elon, giga, ai (+10pts each)
• Whitepaper / Website Link                • Caps at 30pts
         │                                          │
         └────────────────────┬─────────────────────┘
                              ▼
                  [Virality Score (0-100)]
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   [HYPER_VIRAL]         [MODERATE]           [LOW_EFFORT]
   (Score >= 80)       (Score 60-79)         (Score < 40)
   1.4x Position       1.15x Position        0.7x Position
```

Tokens identified as `LOW_EFFORT` (0 social channels, gibberish tickers) are automatically deprioritized by the AI Brain.
