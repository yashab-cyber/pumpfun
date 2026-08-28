# 🧠 Multi-Model AI Brain Matrix & Few-Shot Learning Architecture

The agent features an **Autonomous Quantum Reasoning Matrix** (`aiBrain.ts`) supporting local zero-cost LLMs, proprietary frontier models, local proxies, and continuous on-chain few-shot learning.

---

## 1. Supported AI Providers Matrix

| Provider Key (`AI_PROVIDER`) | Recommended Model | Description & URL | Configuration Keys |
|---|---|---|---|
| **`copilot`** *(Default)* | `gpt-4o` | Local GitHub Copilot proxy | `COPILOT_URL=http://localhost:4141`<br>`COPILOT_API_KEY=dummy` |
| **`anthropic`** | `claude-3-5-haiku-20241022` | Ultra-fast, deep reasoning | `ANTHROPIC_API_KEY=sk-ant-...` |
| **`gemini`** | `gemini-1.5-flash` | Google Gemini API (high speed) | `GEMINI_API_KEY=AIzaSy...` |
| **`ollama`** | `deepseek-r1` / `llama3.3` | $100\%$ Offline local inference | `OLLAMA_HOST=http://localhost:11434` |
| **`openai`** | `gpt-4o-mini` | OpenAI official API | `OPENAI_API_KEY=sk-...` |
| **`openrouter`** | `meta-llama/llama-3.3-70b-instruct` | Unified multi-model gateway | `OPENROUTER_API_KEY=sk-or-...` |
| **`builtin`** | Built-in Neural Engine | Local deterministic heuristics | Zero API key or network required |

---

## 2. Dynamic Few-Shot Memory Pipeline

On every evaluation, the AI Brain pulls the **top 3 recent winning trades** and **top 2 stopped-out trades** from SQLite memory and injects them directly into the LLM context:

```
[New Token Detected] ──► [Query SQLite Trade Journal]
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
    [Recent Wins in Session]           [Recent Losses to Avoid]
    • Win: AIX (+145% PnL)             • Loss: FAKEINU (-20% PnL)
    • Win: PEPE2 (+82% PnL)            • Loss: CLONEAI (-20% PnL)
                 │                                 │
                 └────────────────┬────────────────┘
                                  ▼
                   [Injected into LLM Prompt]
                                  │
                                  ▼
          [LLM Dynamically Adapts to Active Meta]
```

This prevents repeating identical losing patterns while reinforcing current winning meta themes.

---

## 3. Conviction Tiers & Category Profit Multipliers

The AI Brain categorizes evaluated setups into 4 distinct conviction tiers:

| Conviction Tier | AI Confidence | Position Scaling | Description |
|---|---|---|---|
| ⚡ **`SUPER_SNIPE`** | $\ge 90\%$ | **$1.6\text{x}$** Base Size | Highest conviction setup; verified socials, whitepaper, clean dev history. |
| 🎯 **`HIGH_CONVICTION`** | $80\% - 89\%$ | **$1.3\text{x}$** Base Size | Strong narrative momentum with favorable volume velocity. |
| 📊 **`STANDARD`** | $65\% - 79\%$ | **$1.0\text{x}$** Base Size | Standard setup meeting core filter criteria. |
| ⚠️ **`SPECULATIVE`** | $< 65\%$ | **$0.0\text{x}$ (Skipped)** | Insufficient risk/reward; rejected. |

### Dynamic Category Take-Profit Targets
- **`TECH_AI` Tokens**: Dynamic TP1 $+75\%$, TP2 $+150\%$, TP3 $+300\%$ (Technology narrative trends longer).
- **`VIRAL_MEME` Tokens**: Dynamic TP1 $+45\%$, TP2 $+90\%$, TP3 $+180\%$ (High volatility, faster partial scale-out).
