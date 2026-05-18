# MyRSU MCP

[![npm version](https://img.shields.io/npm/v/myrsu-mcp.svg)](https://www.npmjs.com/package/myrsu-mcp)
[![npm downloads](https://img.shields.io/npm/dm/myrsu-mcp.svg)](https://www.npmjs.com/package/myrsu-mcp)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

> An [MCP](https://modelcontextprotocol.io) server that lets your AI assistant analyze single-company concentration risk for tech workers with RSU comp.

When you ask Claude *"I have $700K in NVDA stock — am I dangerously concentrated?"*, this server gives Claude **real numbers** instead of generic advice: a 0-100 Risk Score, your specific Wealth-at-Risk in dollars, historical drawdowns of your employer's stock, prioritized action items, and a pre-filled dashboard URL.

**Privacy-first.** Stateless. Zero logging. No persistence. Calculations run on Cloudflare's edge (or locally via stdio) with nothing stored.

**Companion to:** [myrsu.app](https://myrsu.app) — the free interactive web dashboard.

---

## Install in 30 seconds

### Claude Desktop / Web / any HTTP-MCP client

In your client's "Add custom connector" dialog, paste:

```
https://myrsu-mcp.vidhidev.workers.dev/mcp
```

That's it. No local install, no Node required.

### Claude Code / Cursor / Continue / Cline (stdio)

```bash
claude mcp add myrsu -- npx -y myrsu-mcp
```

Or in your client's config file:

```json
{
  "mcpServers": {
    "myrsu": {
      "command": "npx",
      "args": ["-y", "myrsu-mcp"]
    }
  }
}
```

---

## What it does

Two tools available to the AI:

### `myrsu_analyze_risk`
Full concentration-risk analysis. Inputs: any combination of cash, brokerage, retirement, vested stock, unvested RSUs, home value, mortgage, income, employer, tax rates. Outputs: Risk Score (0–100), concentration %, Wealth-at-Risk, diversification gap, homeowner stress test (months of runway if you lose your job AND the stock crashes 50%), top 3-5 action items, historical drawdown context, pre-filled dashboard URL.

**International support.** Pass `country` (`US`, `IN`, `CA`, `UK`, `EU`, `AU`, `OTHER`) and the response uses the right currency symbol ($/₹/€/£/C$/A$) and the right retirement-account terminology (401(k)/IRA, RRSP/TFSA, ISA/SIPP, EPF/PPF/NPS, Superannuation, etc.). The risk math is identical for all countries — only labels change.

### `myrsu_get_employer`
Quick lookup for 40+ tech-employer presets. Returns annual volatility (σ), historical peak-to-trough drawdowns (NVDA 2022 −66%, META 2022 −76%, etc.), and recommended safe-concentration cap.

Covers NVDA, TSLA, MSFT, GOOGL, META, AAPL, AMZN + enterprise SaaS, cloud/data/security, semiconductors, consumer internet, fintech/crypto, marketplaces/mobility.

---

## Example conversation

> **User:** I work at NVIDIA. I have about $700K in NVDA stock (split $400K vested + $300K unvested RSUs), $300K liquid in cash and ETFs, and earn $250K/yr. No mortgage, no debt. Am I dangerously concentrated?
>
> **Claude:** *(calls `myrsu_analyze_risk` in the background)*
>
> Yes — you're meaningfully concentrated. **Risk Score: 73.5 / 100 — Dangerous.**
>
> 70% of your $1M net worth is tied to a single stock that's also your employer and your income source. That triple overlap is the core problem.
>
> **Historical reference:** NVDA dropped 85% in the 2008 financial crisis. A repeat would take your $700K to ~$105K — cutting your net worth nearly in half to ~$405K.
>
> Your situation is riskier than most because:
> - Income is correlated to NVDA — if the stock falls, layoffs often follow
> - $300K unvested disappears if you lose your job during a downturn
>
> **Practical path forward:**
> - Recommended cap for σ=50% stocks is ~25% of NW (~$250K). You're $450K overweight.
> - At $100K/yr sell pace, you reach safe concentration in ~4.5 years
> - Sell RSUs on vest day — treat each vest as a cash bonus, not a re-investment
>
> Full interactive dashboard: https://myrsu.app/?s=eyJj...

---

## Why this exists

Tech workers with concentrated RSU comp face a real risk that's hard to quantify in their head: most of their wealth AND their income depend on a single company's stock. When Claude is asked about this, the default answer is generic ("consider diversifying, talk to a CPA"). With this MCP loaded, Claude can do the actual math and give a tailored answer.

---

## Privacy

This server is designed to be honest about how user data is handled:

- **Stateless** — same inputs always produce the same outputs. No session state.
- **No logging** — server does not write inputs, outputs, or identifiers to any log.
- **No persistence** — no database, no cache.
- **No third-party calls** — calculation is pure math, runs locally in the Worker process.
- **Open source** — you can audit every line.

When you call this MCP, your inputs (wealth values, employer, income) transit through Cloudflare's network once and are not retained.

If you prefer to run it entirely on your own machine, install the stdio version (`npx -y myrsu-mcp`) — calculations happen on your hardware, never leaving your device.

---

## Development

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/myrsu-mcp
cd myrsu-mcp
npm install

# Run the stdio MCP locally
npm run dev

# Test with the MCP Inspector (visual UI)
npm run inspect

# Build production output
npm run build

# Deploy the HTTP/Streamable transport to Cloudflare
npx wrangler login
npx wrangler deploy
```

### Project layout

```
src/
├── index.ts            # Stdio MCP entry (Claude Code, Cursor, Continue, Cline)
├── index-http.ts       # HTTP/Streamable MCP entry (Cloudflare Worker, Claude Desktop)
├── metrics.ts          # Risk calculation + action item generation
├── presets.ts          # 40+ employer presets (σ + historical drawdowns)
└── tools/
    ├── analyze_risk.ts # myrsu_analyze_risk handler
    └── get_employer.ts # myrsu_get_employer handler
```

Both transports import the same business logic from `metrics.ts` and `presets.ts`. The math is identical regardless of how the AI client connects.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).

## Disclaimer

**Not financial advice.** Volatility presets and historical drawdowns are approximations sourced from public market data. Past performance is not predictive. Tax calculations use simplified models that don't account for AMT, NII, or RSU-vesting ordinary income. Use as a directional signal, not as a substitute for a licensed financial advisor or CPA.
