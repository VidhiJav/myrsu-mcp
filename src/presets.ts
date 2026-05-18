/**
 * Company presets — annual volatility (σ) and historical drawdowns
 * for 40+ public tech employers + manual fallback.
 *
 * Source: ported from MyRSU web app. Volatility values are approximations
 * based on ~2-year realized vol as of 2026. Historical drawdowns are
 * approximate peak-to-trough drops, sourced from public records.
 *
 * NOTE: Past performance ≠ future performance. These numbers ground σ
 * in real history but should be treated as directional, not predictive.
 */

export interface DrawdownEvent {
  year: string;
  drop: number;   // 0..1 (e.g. 0.66 = 66%)
  label: string;  // short event description
}

export interface CompanyPreset {
  name: string;
  ticker?: string;        // for canonical lookups
  vol: number | null;     // 0..1; null means "manual entry" (the "Other" placeholder)
  drawdowns?: DrawdownEvent[];
  category: string;
}

export const COMPANY_PRESETS: CompanyPreset[] = [
  // ----- Mega-Cap Tech -----
  { name: "NVIDIA",         ticker: "NVDA",  vol: 0.50, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.66, label: "Tech sell-off" }, { year: "2008", drop: 0.85, label: "Financial crisis" }] },
  { name: "Tesla",          ticker: "TSLA",  vol: 0.65, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.73, label: "Rate-hike sell-off" }, { year: "2020", drop: 0.60, label: "COVID crash" }] },
  { name: "Amazon",         ticker: "AMZN",  vol: 0.35, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.56, label: "Tech sell-off" }, { year: "2000", drop: 0.95, label: "Dot-com crash" }] },
  { name: "Meta Platforms", ticker: "META",  vol: 0.40, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.76, label: "Reels/CapEx panic" }, { year: "2018", drop: 0.43, label: "Cambridge Analytica" }] },
  { name: "Alphabet",       ticker: "GOOGL", vol: 0.28, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.45, label: "Tech sell-off" }, { year: "2008", drop: 0.65, label: "Financial crisis" }] },
  { name: "Apple",          ticker: "AAPL",  vol: 0.25, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.32, label: "Tech sell-off" }, { year: "2008", drop: 0.60, label: "Financial crisis" }] },
  { name: "Microsoft",      ticker: "MSFT",  vol: 0.25, category: "Mega-Cap Tech",
    drawdowns: [{ year: "2022", drop: 0.39, label: "Tech sell-off" }, { year: "2008", drop: 0.50, label: "Financial crisis" }] },

  // ----- Enterprise SaaS -----
  { name: "Salesforce",     ticker: "CRM",   vol: 0.32, category: "Enterprise SaaS",
    drawdowns: [{ year: "2022", drop: 0.59, label: "SaaS revaluation" }] },
  { name: "Adobe",          ticker: "ADBE",  vol: 0.30, category: "Enterprise SaaS",
    drawdowns: [{ year: "2022", drop: 0.54, label: "SaaS revaluation" }] },
  { name: "Oracle",         ticker: "ORCL",  vol: 0.25, category: "Enterprise SaaS" },
  { name: "ServiceNow",     ticker: "NOW",   vol: 0.32, category: "Enterprise SaaS",
    drawdowns: [{ year: "2022", drop: 0.48, label: "SaaS revaluation" }] },
  { name: "Workday",        ticker: "WDAY",  vol: 0.35, category: "Enterprise SaaS",
    drawdowns: [{ year: "2022", drop: 0.51, label: "SaaS revaluation" }] },
  { name: "Atlassian",      ticker: "TEAM",  vol: 0.50, category: "Enterprise SaaS",
    drawdowns: [{ year: "2022", drop: 0.78, label: "SaaS revaluation" }] },

  // ----- Cloud / Data / Security -----
  { name: "Snowflake",      ticker: "SNOW",  vol: 0.50, category: "Cloud / Data / Security",
    drawdowns: [{ year: "2022", drop: 0.69, label: "Multiples reset" }] },
  { name: "Datadog",        ticker: "DDOG",  vol: 0.50, category: "Cloud / Data / Security",
    drawdowns: [{ year: "2022", drop: 0.61, label: "Multiples reset" }] },
  { name: "MongoDB",        ticker: "MDB",   vol: 0.55, category: "Cloud / Data / Security",
    drawdowns: [{ year: "2022", drop: 0.74, label: "Multiples reset" }] },
  { name: "Cloudflare",     ticker: "NET",   vol: 0.55, category: "Cloud / Data / Security",
    drawdowns: [{ year: "2022", drop: 0.82, label: "Multiples reset" }] },
  { name: "CrowdStrike",    ticker: "CRWD",  vol: 0.45, category: "Cloud / Data / Security",
    drawdowns: [{ year: "2022", drop: 0.55, label: "Multiples reset" }] },
  { name: "Palantir",       ticker: "PLTR",  vol: 0.65, category: "Cloud / Data / Security",
    drawdowns: [{ year: "2022", drop: 0.84, label: "Multiples reset" }] },

  // ----- Semiconductors -----
  { name: "AMD",            ticker: "AMD",   vol: 0.50, category: "Semiconductors",
    drawdowns: [{ year: "2022", drop: 0.62, label: "Tech sell-off" }] },
  { name: "Intel",          ticker: "INTC",  vol: 0.38, category: "Semiconductors",
    drawdowns: [{ year: "2024", drop: 0.62, label: "Foundry stumble" }] },
  { name: "Broadcom",       ticker: "AVGO",  vol: 0.35, category: "Semiconductors" },
  { name: "TSMC",           ticker: "TSM",   vol: 0.30, category: "Semiconductors" },
  { name: "Micron",         ticker: "MU",    vol: 0.50, category: "Semiconductors",
    drawdowns: [{ year: "2022", drop: 0.49, label: "Memory cycle bust" }] },
  { name: "Qualcomm",       ticker: "QCOM",  vol: 0.32, category: "Semiconductors" },
  { name: "ARM",            ticker: "ARM",   vol: 0.50, category: "Semiconductors" },

  // ----- Consumer Internet -----
  { name: "Netflix",        ticker: "NFLX",  vol: 0.40, category: "Consumer Internet",
    drawdowns: [{ year: "2022", drop: 0.76, label: "Sub-loss panic" }] },
  { name: "Spotify",        ticker: "SPOT",  vol: 0.40, category: "Consumer Internet",
    drawdowns: [{ year: "2022", drop: 0.65, label: "Tech sell-off" }] },
  { name: "Snap",           ticker: "SNAP",  vol: 0.60, category: "Consumer Internet",
    drawdowns: [{ year: "2022", drop: 0.91, label: "Ad-revenue collapse" }] },
  { name: "Pinterest",      ticker: "PINS",  vol: 0.50, category: "Consumer Internet",
    drawdowns: [{ year: "2022", drop: 0.79, label: "Ad-revenue weakness" }] },
  { name: "Reddit",         ticker: "RDDT",  vol: 0.70, category: "Consumer Internet" },
  { name: "Roblox",         ticker: "RBLX",  vol: 0.55, category: "Consumer Internet",
    drawdowns: [{ year: "2022", drop: 0.83, label: "Reopening fade" }] },

  // ----- Fintech / Crypto -----
  { name: "PayPal",         ticker: "PYPL",  vol: 0.40, category: "Fintech / Crypto",
    drawdowns: [{ year: "2022", drop: 0.76, label: "Margin compression" }] },
  { name: "Block (Square)", ticker: "SQ",    vol: 0.55, category: "Fintech / Crypto",
    drawdowns: [{ year: "2022", drop: 0.84, label: "Multiples reset" }] },
  { name: "Coinbase",       ticker: "COIN",  vol: 0.75, category: "Fintech / Crypto",
    drawdowns: [{ year: "2022", drop: 0.89, label: "Crypto winter" }] },
  { name: "Robinhood",      ticker: "HOOD",  vol: 0.65, category: "Fintech / Crypto",
    drawdowns: [{ year: "2022", drop: 0.91, label: "Retail-trading bust" }] },

  // ----- Marketplaces / Mobility -----
  { name: "Uber",           ticker: "UBER",  vol: 0.40, category: "Marketplaces / Mobility",
    drawdowns: [{ year: "2022", drop: 0.51, label: "Tech sell-off" }] },
  { name: "Lyft",           ticker: "LYFT",  vol: 0.55, category: "Marketplaces / Mobility",
    drawdowns: [{ year: "2022", drop: 0.78, label: "Tech sell-off" }] },
  { name: "Airbnb",         ticker: "ABNB",  vol: 0.40, category: "Marketplaces / Mobility",
    drawdowns: [{ year: "2022", drop: 0.51, label: "Tech sell-off" }] },
  { name: "DoorDash",       ticker: "DASH",  vol: 0.50, category: "Marketplaces / Mobility",
    drawdowns: [{ year: "2022", drop: 0.74, label: "Reopening fade" }] },
  { name: "Shopify",        ticker: "SHOP",  vol: 0.55, category: "Marketplaces / Mobility",
    drawdowns: [{ year: "2022", drop: 0.78, label: "Reopening fade" }] },
];

/**
 * Look up a company preset by ticker, name, or partial match.
 * Case-insensitive. Returns null if no match found.
 *
 * Examples that all match NVIDIA:
 *   findCompany("NVDA")
 *   findCompany("nvidia")
 *   findCompany("Nvidia")
 */
export function findCompany(tickerOrName: string): CompanyPreset | null {
  const q = tickerOrName.trim().toLowerCase();
  if (!q) return null;

  // exact ticker match first
  const byTicker = COMPANY_PRESETS.find(
    (c) => c.ticker && c.ticker.toLowerCase() === q,
  );
  if (byTicker) return byTicker;

  // exact name match
  const byName = COMPANY_PRESETS.find((c) => c.name.toLowerCase() === q);
  if (byName) return byName;

  // partial name match (e.g. "meta" -> "Meta Platforms")
  const partial = COMPANY_PRESETS.find((c) =>
    c.name.toLowerCase().startsWith(q) ||
    c.name.toLowerCase().includes(q),
  );
  return partial || null;
}

/**
 * Volatility-based recommended max allocation:
 *   σ > 50%   →  20%  (conservative end of 20–25%)
 *   σ 30-50%  →  25%  (conservative end of 25–35%)
 *   σ < 30%   →  30%  (conservative end of 30–40%)
 *
 * Derived from Modern Portfolio Theory (Target Risk / σ²) with practical caps.
 */
export function recommendedMaxAllocation(volatility: number): number {
  if (volatility > 0.5) return 0.2;
  if (volatility >= 0.3) return 0.25;
  return 0.3;
}
