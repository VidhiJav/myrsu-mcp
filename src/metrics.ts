/**
 * MyRSU concentration-risk math, ported from the web app.
 *
 * All calculations are deterministic and stateless. Same inputs → same output.
 * No network calls, no logging, no persistence.
 */

import { recommendedMaxAllocation } from "./presets.js";

// ---- Inputs --------------------------------------------------------------
export interface RiskInputs {
  // Wealth (one or more required, $)
  cash?: number;
  diversifiedInvestments?: number;   // taxable brokerage, ETFs, bonds, OTHER companies' stocks
  retirementAccounts?: number;       // 401(k), IRA, Roth — discounted in stress test
  vestedCompanyStock?: number;
  unvestedRSUs?: number;
  homeValue?: number;                // gross market value, NOT equity
  otherAssets?: number;

  // Liabilities ($)
  mortgage?: number;
  studentLoans?: number;
  creditCardDebt?: number;
  otherDebt?: number;

  // Income ($/yr)
  employerIncome?: number;           // from your employer (incl. RSU vesting)
  otherIncome?: number;              // spouse, side, dividends from non-employer

  // Employer
  employerName?: string;             // human-friendly, used in narratives
  employerVolatility: number;        // 0..1 (e.g. 0.50 = 50%)
  employerType?: "public_company" | "high_growth_tech" | "startup";

  // Tax (optional)
  federalLtcgPct?: number;           // e.g. 20 for 20%
  stateTaxPct?: number;              // e.g. 13.3 for CA
  costBasis?: number;
  includeNII?: boolean;
}

// ---- Output --------------------------------------------------------------
export type RiskBand = "Healthy" | "Elevated" | "Dangerous" | "Critical";

export interface ActionItem {
  priority: "high" | "medium" | "info";
  title: string;
  summary: string;
}

export interface RiskResult {
  // Headline
  riskScore: number;                  // 0-100
  riskBand: RiskBand;

  // Computed wealth
  netWorth: number;
  grossAssets: number;
  totalDebt: number;
  liquidAssets: number;
  companyStock: number;

  // Risk metrics
  concentrationPct: number;           // 0..1
  liquidityRatioPct: number;          // 0..1
  debtRatioPct: number;               // 0..1
  wealthAtRiskUsd: number;
  recommendedMaxAllocationPct: number; // 0..1
  recommendedExposureUsd: number;
  diversificationGapUsd: number;
  overweightPct: number;              // 0..1

  // Stress test (homeowners)
  crashJobLossRunwayMonths: number | null;

  // Tax (if inputs provided)
  combinedTaxRatePct: number;         // 0..1
  embeddedGainUsd: number;
  taxIfSellAllVestedUsd: number;

  // Estimated time to reach the safe cap, assuming roughly $100K/yr of
  // diversification pace (typical for a mid-senior FAANG employee with RSU vesting).
  // Returns null if no diversification gap.
  estimatedYearsToSafe: number | null;

  // Vivid framing helpers (precomputed for downstream text use)
  worstCaseLossUsd: number;           // 50% crash on the company stock
  netWorthAfterWorstCase: number;     // NW − 0.5 × company stock

  // Action items (always ≥2; up to 5)
  topActionItems: ActionItem[];
}

// ---- Helpers -------------------------------------------------------------
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function bandFor(score: number): RiskBand {
  if (score < 35) return "Healthy";
  if (score < 60) return "Elevated";
  if (score < 80) return "Dangerous";
  return "Critical";
}

function rhoFor(employerType?: RiskInputs["employerType"]): number {
  switch (employerType) {
    case "high_growth_tech": return 0.75;
    case "startup":          return 0.85;
    default:                 return 0.6;  // public_company default
  }
}

// ---- Main analysis -------------------------------------------------------
export function analyzeRisk(inputs: RiskInputs): RiskResult {
  // Derive computed wealth
  const cash         = inputs.cash || 0;
  const diversified  = inputs.diversifiedInvestments || 0;
  const retirement   = inputs.retirementAccounts || 0;
  const vested       = inputs.vestedCompanyStock || 0;
  const unvested     = inputs.unvestedRSUs || 0;
  const homeValue    = inputs.homeValue || 0;
  const otherAssets  = inputs.otherAssets || 0;

  const mortgage     = inputs.mortgage || 0;
  const studentLoans = inputs.studentLoans || 0;
  const ccDebt       = inputs.creditCardDebt || 0;
  const otherDebt    = inputs.otherDebt || 0;

  const employerInc  = inputs.employerIncome || 0;
  const otherInc     = inputs.otherIncome || 0;

  const liquidAssets = cash + diversified + retirement;
  // Stress-test variant: retirement counted at 70% (early-withdrawal penalty)
  const liquidForStress = cash + diversified + retirement * 0.7;
  const grossAssets = liquidAssets + vested + unvested + homeValue + otherAssets;
  const totalDebt   = mortgage + studentLoans + ccDebt + otherDebt;
  const netWorth    = grossAssets - totalDebt;

  const totalIncome  = employerInc + otherInc;
  const incomeDep    = totalIncome > 0 ? employerInc / totalIncome : 0;

  const companyStock = vested + unvested;
  const concentration = netWorth > 0 ? companyStock / netWorth : 0;
  const liqRatio = netWorth > 0 ? liquidAssets / netWorth : 0;
  const debtRatio = grossAssets > 0 ? totalDebt / grossAssets : 0;
  const sigma = inputs.employerVolatility;

  // Risk Score 0-100 (direct, no FFI middleman)
  const riskScore = clamp(
    30 * concentration +
      25 * incomeDep +
      20 * sigma +
      15 * (1 - liqRatio) +
      10 * debtRatio +
      20 * concentration * sigma,
    0,
    100,
  );
  const riskBand = bandFor(riskScore);

  // Wealth-at-Risk (2σ shock)
  const war = netWorth * concentration * sigma * 2;

  // Recommended allocation
  const recMax = recommendedMaxAllocation(sigma);
  const recExposure = netWorth * recMax;
  const divGap = Math.max(0, companyStock - recExposure);
  const overweightPct = Math.max(0, concentration - recMax);

  // ---- Stress test: 50% crash + job loss ---------------------------------
  // Vested stock at half value. Unvested RSU forfeited entirely (job loss).
  const monthlyHousing = mortgage > 0 ? Math.round(mortgage * 0.00831) : 0;
  const monthlyOther   = mortgage > 0
    ? Math.round(monthlyHousing * 0.7)
    : Math.round((totalIncome / 12) * 0.3);
  const monthlyEssentials = monthlyHousing + monthlyOther;

  const stressVested  = vested * 0.5;
  const stressLiquid  = liquidForStress;
  const stressAvail   = stressLiquid + stressVested;
  const survivingIncome = otherInc;  // employer income → 0 in scenario
  const burn = Math.max(0, monthlyEssentials - survivingIncome / 12);
  const runwayMonths = burn > 0 ? stressAvail / burn : Infinity;

  // ---- Tax (optional) ----------------------------------------------------
  const fed = inputs.federalLtcgPct || 0;
  const state = inputs.stateTaxPct || 0;
  const nii = inputs.includeNII ? 3.8 : 0;
  const combinedTaxRate = clamp((fed + state + nii) / 100, 0, 0.99);
  const embeddedGain = Math.max(0, vested - (inputs.costBasis || 0));
  const taxOwed = embeddedGain * combinedTaxRate;

  // ---- Vivid framing helpers --------------------------------------------
  const worstCaseLoss = companyStock * 0.5;
  const nwAfterWorstCase = netWorth - worstCaseLoss;

  // ---- Time to safe (back-of-envelope) ----------------------------------
  // Assume the user can divert ~$100K/yr if they have meaningful RSU comp,
  // otherwise scale to 25% of employer income (rough vest-and-sell pace).
  const assumedPace = employerInc > 200_000 ? 100_000 : Math.max(20_000, employerInc * 0.25);
  const estYearsToSafe = divGap > 0 && assumedPace > 0
    ? Number((divGap / assumedPace).toFixed(1))
    : null;

  // ---- Action items ------------------------------------------------------
  const actions: ActionItem[] = [];

  // 1. Homeowner stress test (only if mortgage > 0)
  if (mortgage > 0) {
    let priority: ActionItem["priority"] = "info";
    let runwayLabel = "✓ Strong runway";
    if (runwayMonths < 6) { priority = "high"; runwayLabel = "🚨 Critical — months only"; }
    else if (runwayMonths < 12) { priority = "high"; runwayLabel = "⚠ Tight — about a year"; }
    else if (runwayMonths < 24) { priority = "medium"; runwayLabel = "⚠ 1-2 year cushion"; }
    else if (runwayMonths < 60) { priority = "info"; runwayLabel = "✓ 2-5 year cushion"; }
    actions.push({
      priority,
      title: `Crash + Job Loss Stress Test: ${runwayLabel}`,
      summary: `If ${inputs.employerName || "your employer"} crashed 50% and you lost your job: ` +
               `~$${Math.round(stressAvail).toLocaleString()} available ` +
               `(after unvested RSU forfeit, retirement at 70%). ` +
               `Mortgage burn ~$${monthlyEssentials.toLocaleString()}/mo. ` +
               `Runway: ${isFinite(runwayMonths) ? Math.floor(runwayMonths) + " months" : "unlimited"}.`,
    });
  }

  // 2. Diversification gap (with timeline + tax estimate)
  if (divGap > 0) {
    const proRataTax = taxOwed * (divGap / Math.max(vested, 1));
    const paceLine = estYearsToSafe != null
      ? ` At ~$${Math.round(assumedPace).toLocaleString()}/yr diversification pace, this takes about ${estYearsToSafe} years.`
      : "";
    const taxLine = proRataTax > 0
      ? ` Estimated tax cost: ~$${Math.round(proRataTax).toLocaleString()} (at your provided rate).`
      : (combinedTaxRate === 0
          ? " Tax cost depends on your federal + state brackets — provide federal_ltcg_pct and state_tax_pct for a precise estimate."
          : "");
    actions.push({
      priority: divGap > netWorth * 0.2 ? "high" : "medium",
      title: "Reduce Single-Stock Exposure",
      summary: `You are $${Math.round(divGap).toLocaleString()} overweight in ${inputs.employerName || "your company"}. ` +
               `Sell down to the recommended ${Math.round(recMax * 100)}% cap for σ-${Math.round(sigma * 100)}% stocks.` +
               paceLine + taxLine,
    });
  }

  // 3. Liquid buffer (when low)
  if (liqRatio < 0.25 && netWorth > 0) {
    const target = Math.round(netWorth * 0.25);
    const gap = target - liquidAssets;
    actions.push({
      priority: liqRatio < 0.1 ? "high" : "medium",
      title: "Build a Larger Liquid Buffer",
      summary: `You have ${Math.round(liqRatio * 100)}% of net worth liquid. ` +
               `Aim for 25%+ ($${target.toLocaleString()}) before adding more concentration. ` +
               `Gap to close: $${gap.toLocaleString()}.`,
    });
  }

  // 4. Debt burden
  if (debtRatio > 0.5) {
    actions.push({
      priority: "medium",
      title: "Lower Your Debt Burden",
      summary: `Debt is ${Math.round(debtRatio * 100)}% of gross assets. ` +
               `High debt plus high concentration is a fragility multiplier — if the stock falls, the debt doesn't. ` +
               `Pay down high-interest first.`,
    });
  }

  // 5. Tax-aware diversification (only when embedded gain is meaningful)
  if (embeddedGain > 100_000 && combinedTaxRate > 0.15) {
    actions.push({
      priority: "info",
      title: "Consider Tax-Aware Diversification",
      summary: `You have ~$${Math.round(embeddedGain).toLocaleString()} in embedded gains on vested stock. ` +
               `Explore Donor-Advised Funds, exchange funds, or tax-loss harvesting elsewhere to offset.`,
    });
  }

  // ---- Soft action items (always present so response feels complete) -----

  // 6. Vest-and-sell discipline (when stock is meaningful and concentration is non-trivial)
  if (companyStock > 0 && concentration > 0.10 && divGap > 0) {
    actions.push({
      priority: "info",
      title: "Sell on Every Vest (default rule)",
      summary: `Set a personal rule: when RSUs vest, sell the same day and invest the proceeds in a diversified index fund. ` +
               `Treats each vest as cash income, not a re-investment in your employer.`,
    });
  }

  // 7. Healthy liquid buffer acknowledgement (when liquidity is already OK)
  if (liqRatio >= 0.25 && companyStock > 0) {
    actions.push({
      priority: "info",
      title: "Liquid Buffer Is Healthy",
      summary: `Your liquid ratio is ${Math.round(liqRatio * 100)}% — good. Let it grow as you diversify; don't reinvest sell-proceeds back into stocks until concentration drops to the safe cap.`,
    });
  }

  // 8. "Don't add" rule (always relevant for anyone above the cap)
  if (divGap > 0) {
    actions.push({
      priority: "info",
      title: "Don't Add More Company Stock",
      summary: `While overweight, decline any ESPP discount that would increase exposure, and direct bonuses to cash or diversified investments — not back into ${inputs.employerName || "the employer"} stock.`,
    });
  }

  // Fallback: all clear
  if (actions.filter((a) => a.priority === "high" || a.priority === "medium").length === 0
      && actions.length < 2) {
    actions.unshift({
      priority: "info",
      title: "You're In Good Shape",
      summary: "Concentration, liquidity, and debt are within healthy ranges. Maintain discipline — sell on every vest to keep concentration where it is.",
    });
  }

  return {
    riskScore: Number(riskScore.toFixed(1)),
    riskBand,
    netWorth: Math.round(netWorth),
    grossAssets: Math.round(grossAssets),
    totalDebt: Math.round(totalDebt),
    liquidAssets: Math.round(liquidAssets),
    companyStock: Math.round(companyStock),
    concentrationPct: Number(concentration.toFixed(4)),
    liquidityRatioPct: Number(liqRatio.toFixed(4)),
    debtRatioPct: Number(debtRatio.toFixed(4)),
    wealthAtRiskUsd: Math.round(war),
    recommendedMaxAllocationPct: Number(recMax.toFixed(4)),
    recommendedExposureUsd: Math.round(recExposure),
    diversificationGapUsd: Math.round(divGap),
    overweightPct: Number(overweightPct.toFixed(4)),
    crashJobLossRunwayMonths: mortgage > 0
      ? (isFinite(runwayMonths) ? Math.round(runwayMonths * 10) / 10 : null)
      : null,
    combinedTaxRatePct: Number(combinedTaxRate.toFixed(4)),
    embeddedGainUsd: Math.round(embeddedGain),
    taxIfSellAllVestedUsd: Math.round(taxOwed),
    estimatedYearsToSafe: estYearsToSafe,
    worstCaseLossUsd: Math.round(worstCaseLoss),
    netWorthAfterWorstCase: Math.round(nwAfterWorstCase),
    topActionItems: actions.slice(0, 5),
  };
}
