/**
 * Tool: myrsu_analyze_risk
 *
 * The main MCP tool — full concentration-risk analysis.
 * Takes any combination of wealth/income/employer inputs and returns
 * a complete risk picture (score, action items, dashboard URL).
 */

import { z } from "zod";
import { analyzeRisk, symbolForCountry, type RiskInputs, type CountryCode } from "../metrics.js";
import { findCompany, type DrawdownEvent } from "../presets.js";

// ---- Input schema (Zod) --------------------------------------------------
// All fields optional so the AI can call with whatever the user has shared.
// Defaults to 0 / undefined where missing.
export const analyzeRiskInputSchema = {
  cash: z.number().nonnegative().optional()
    .describe("Cash, savings, money market funds, CDs (in the user's local currency)."),
  diversified_investments: z.number().nonnegative().optional()
    .describe("Taxable brokerage account: ETFs, index funds, bonds, OTHER companies' stocks. Non-retirement."),
  retirement_accounts: z.number().nonnegative().optional()
    .describe("Retirement / tax-advantaged accounts: 401(k)/IRA (US), RRSP/TFSA (Canada), ISA/SIPP (UK), EPF/PPF/NPS (India), Superannuation (Australia), etc. Counted full for Net Worth but discounted to 70% in the stress test."),
  vested_company_stock: z.number().nonnegative().optional()
    .describe("Employer shares the user already owns outright ($, current market value)."),
  unvested_rsus: z.number().nonnegative().optional()
    .describe("Future RSU shares at today's price. Note: forfeited if user loses job."),
  home_value: z.number().nonnegative().optional()
    .describe("Today's estimated market value of the home (gross, NOT equity). Leave 0 if user rents."),
  other_assets: z.number().nonnegative().optional()
    .describe("Crypto, cars, business stake, collectibles."),

  mortgage: z.number().nonnegative().optional()
    .describe("Outstanding mortgage balance ($). Used for the homeowner stress test."),
  student_loans: z.number().nonnegative().optional(),
  credit_card_debt: z.number().nonnegative().optional(),
  other_debt: z.number().nonnegative().optional(),

  employer_income: z.number().nonnegative().optional()
    .describe("Annual income from the employer: salary + bonus + RSU vesting."),
  other_income: z.number().nonnegative().optional()
    .describe("Annual income that does NOT depend on the employer: spouse, side hustle, dividends from other companies, rentals."),

  employer_ticker: z.string().optional()
    .describe("Stock ticker or company name (e.g. 'NVDA', 'NVIDIA', 'Tesla'). Used to look up annual volatility. If not in the preset list, supply employer_volatility_pct instead."),
  employer_volatility_pct: z.number().min(0).max(200).optional()
    .describe("Annual volatility (σ) as a percent (e.g. 50 for 50%). Override if employer_ticker isn't recognized."),
  employer_type: z.enum(["public_company", "high_growth_tech", "startup"]).optional()
    .describe("Affects how correlated the user's income is with the stock. Public company is the safer default."),

  federal_ltcg_pct: z.number().min(0).max(50).optional()
    .describe("National long-term capital gains rate as a percent (US: 15-20; UK basic: 10; UK higher: 20; India LTCG over ₹1L: 10; Canada: 50% inclusion × marginal rate; AU: marginal rate w/ 50% discount if held 12mo+)."),
  state_tax_pct: z.number().min(0).max(20).optional()
    .describe("Local/state/provincial capital gains tax rate as a percent. US: 0 in TX/FL/WA, ~13.3 in CA. Use 0 if your country has no sub-national capital gains tax."),
  cost_basis: z.number().nonnegative().optional()
    .describe("Average cost basis of vested stock (price the user acquired at)."),
  include_nii: z.boolean().optional()
    .describe("US-only: include the 3.8% Net Investment Income surcharge (applies if AGI > $200K single / $250K married). Leave false outside the US."),

  // ---- Localization (terminology only — math is identical across countries) ----
  country: z.enum(["US", "IN", "CA", "UK", "EU", "AU", "OTHER"]).optional()
    .describe("Country code for response terminology. Affects retirement-account names referenced (401k vs RRSP vs ISA vs EPF vs Super), tax-aware diversification suggestions, and currency symbol. Default 'US'. The risk math is identical for all countries."),
  currency_symbol: z.string().max(3).optional()
    .describe("Override currency symbol for formatted output (e.g. '$', '₹', '€', '£', 'C$', 'A$'). If omitted, derived from `country` (US→$, IN→₹, UK→£, EU→€, CA→C$, AU→A$)."),
};

export type AnalyzeRiskInput = {
  [K in keyof typeof analyzeRiskInputSchema]: z.infer<typeof analyzeRiskInputSchema[K]>;
};

// ---- Handler -------------------------------------------------------------
export async function analyzeRiskHandler(args: AnalyzeRiskInput) {
  // Resolve employer volatility + drawdowns from ticker if provided
  let volatility = args.employer_volatility_pct != null
    ? args.employer_volatility_pct / 100
    : undefined;
  let employerName = args.employer_ticker;
  let drawdowns: DrawdownEvent[] = [];

  if (args.employer_ticker) {
    const preset = findCompany(args.employer_ticker);
    if (preset && preset.vol != null) {
      if (volatility == null) volatility = preset.vol;
      employerName = preset.name;
      drawdowns = preset.drawdowns || [];
    }
  }

  if (volatility == null) {
    return {
      content: [{
        type: "text" as const,
        text: "I need either a known employer ticker (e.g. NVDA, TSLA, MSFT) or `employer_volatility_pct` to calculate. Ask the user which company they work at, or what their best guess of the stock's annual volatility is.",
      }],
      isError: true,
    };
  }

  // Build RiskInputs
  const riskInputs: RiskInputs = {
    cash: args.cash,
    diversifiedInvestments: args.diversified_investments,
    retirementAccounts: args.retirement_accounts,
    vestedCompanyStock: args.vested_company_stock,
    unvestedRSUs: args.unvested_rsus,
    homeValue: args.home_value,
    otherAssets: args.other_assets,
    mortgage: args.mortgage,
    studentLoans: args.student_loans,
    creditCardDebt: args.credit_card_debt,
    otherDebt: args.other_debt,
    employerIncome: args.employer_income,
    otherIncome: args.other_income,
    employerName,
    employerVolatility: volatility,
    employerType: args.employer_type,
    federalLtcgPct: args.federal_ltcg_pct,
    stateTaxPct: args.state_tax_pct,
    costBasis: args.cost_basis,
    includeNII: args.include_nii,
    country: args.country as CountryCode | undefined,
    currencySymbol: args.currency_symbol,
  };

  const result = analyzeRisk(riskInputs);

  // Pick the worst historical drawdown for vivid framing (if available)
  const worstDrawdown = drawdowns.length > 0
    ? drawdowns.reduce((a, b) => (b.drop > a.drop ? b : a))
    : null;
  const historicalLossUsd = worstDrawdown
    ? Math.round(result.companyStock * worstDrawdown.drop)
    : 0;

  // Build pre-filled dashboard URL so user can land on the web app with their numbers loaded
  const dashboardUrl = buildDashboardUrl(riskInputs);

  // Human-readable summary for the AI to use in its reply
  const cur = symbolForCountry(args.country as CountryCode | undefined, args.currency_symbol);
  const summary = formatSummary(result, employerName, dashboardUrl, worstDrawdown, historicalLossUsd, cur);

  return {
    content: [{
      type: "text" as const,
      text: summary,
    }],
    structuredContent: {
      ...result,
      historicalContext: worstDrawdown
        ? {
            event: `${employerName} fell ${Math.round(worstDrawdown.drop * 100)}% in ${worstDrawdown.year} (${worstDrawdown.label})`,
            equivalentLossTodayUsd: historicalLossUsd,
            netWorthAfterHistoricalLoss: result.netWorth - historicalLossUsd,
          }
        : null,
      dashboardUrl,
    },
  };
}

// ---- URL pre-fill encoding -----------------------------------------------
// Builds a URL like https://myrsu.app/?s=<base64-json> that the web app
// reads on load to populate inputs.
function buildDashboardUrl(inputs: RiskInputs): string {
  // Compact key map for URL economy
  const compact: Record<string, unknown> = {
    c:  inputs.cash,
    di: inputs.diversifiedInvestments,
    r:  inputs.retirementAccounts,
    v:  inputs.vestedCompanyStock,
    u:  inputs.unvestedRSUs,
    hv: inputs.homeValue,
    oa: inputs.otherAssets,
    m:  inputs.mortgage,
    sl: inputs.studentLoans,
    cc: inputs.creditCardDebt,
    od: inputs.otherDebt,
    ei: inputs.employerIncome,
    oi: inputs.otherIncome,
    en: inputs.employerName,
    ev: inputs.employerVolatility,
    et: inputs.employerType,
    f:  inputs.federalLtcgPct,
    s:  inputs.stateTaxPct,
    cb: inputs.costBasis,
    nii: inputs.includeNII,
  };
  // Strip undefineds
  const cleaned: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(compact)) {
    if (val !== undefined && val !== 0 && val !== null && val !== "") cleaned[k] = val;
  }
  const json = JSON.stringify(cleaned);
  const b64 = Buffer.from(json, "utf-8").toString("base64url");
  return `https://myrsu.app/?s=${b64}`;
}

function formatSummary(
  r: ReturnType<typeof analyzeRisk>,
  employerName: string | undefined,
  dashboardUrl: string,
  worstDrawdown: DrawdownEvent | null,
  historicalLossUsd: number,
  cur: string,
): string {
  const co = employerName || "your employer";
  const concPct = Math.round(r.concentrationPct * 100);
  const fmt = (n: number) => `${cur}${Math.round(n).toLocaleString()}`;
  const lines: string[] = [];

  // ---- Headline ----------------------------------------------------------
  lines.push(`**Single-Company Risk Score: ${r.riskScore} / 100 — ${r.riskBand}**`);
  lines.push("");

  // ---- Vivid framing (the gut-punch) -------------------------------------
  if (r.companyStock > 0 && r.netWorth > 0) {
    lines.push(`**${concPct}% of your ${fmt(r.netWorth)} net worth is in ${co}.** ` +
               `A severe move on that stock could erase **${fmt(r.wealthAtRiskUsd)}** ` +
               `— most of what you have.`);
    lines.push("");
  }

  // ---- Historical reference (if we have data for this employer) ---------
  if (worstDrawdown && historicalLossUsd > 0) {
    lines.push(`**Historical reference:** ${co} fell ${Math.round(worstDrawdown.drop * 100)}% in ${worstDrawdown.year} (${worstDrawdown.label}). ` +
               `A repeat today would cost you **${fmt(historicalLossUsd)}** of net worth ` +
               `(your ${fmt(r.companyStock)} stock → ${fmt(r.companyStock - historicalLossUsd)}, ` +
               `net worth ${fmt(r.netWorth)} → ${fmt(r.netWorth - historicalLossUsd)}).`);
    lines.push("");
  }

  // ---- Key numbers (compact) --------------------------------------------
  lines.push("Key metrics:");
  lines.push(`- Net Worth (computed): ${fmt(r.netWorth)}`);
  lines.push(`- Company stock: ${fmt(r.companyStock)} (${(r.concentrationPct * 100).toFixed(1)}% of net worth)`);
  lines.push(`- Recommended max: ${Math.round(r.recommendedMaxAllocationPct * 100)}% of net worth (${fmt(r.recommendedExposureUsd)})`);
  if (r.diversificationGapUsd > 0) {
    lines.push(`- Diversification gap: ${fmt(r.diversificationGapUsd)} overweight (${Math.round(r.overweightPct * 100)}%)`);
  }
  if (r.estimatedYearsToSafe != null) {
    lines.push(`- Estimated time to safe (at a typical diversification pace): ${r.estimatedYearsToSafe} years`);
  }
  if (r.crashJobLossRunwayMonths != null) {
    lines.push(`- Crash + job loss runway: ${r.crashJobLossRunwayMonths} months`);
  }
  lines.push("");

  // ---- Action items ------------------------------------------------------
  lines.push("**What to do:**");
  for (const a of r.topActionItems) {
    const icon = a.priority === "high" ? "🚨" : a.priority === "medium" ? "⚠" : "ℹ️";
    lines.push(`${icon} **${a.title}** — ${a.summary}`);
  }
  lines.push("");

  // ---- Dashboard link + disclaimer --------------------------------------
  lines.push(`Full interactive dashboard with these numbers pre-filled: ${dashboardUrl}`);
  lines.push("");
  lines.push(`_Not financial advice. This calculation ran locally — no data stored or transmitted._`);
  return lines.join("\n");
}
