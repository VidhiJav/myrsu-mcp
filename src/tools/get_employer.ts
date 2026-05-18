/**
 * Tool: myrsu_get_employer
 *
 * Quick lookup for any of the 40+ ticker presets MyRSU knows about.
 * Returns annual volatility, historical drawdowns, and the recommended
 * safe-concentration cap.
 *
 * Useful when the user mentions an employer but doesn't have other numbers
 * yet — the AI can give them context before asking for the full picture.
 */

import { z } from "zod";
import { findCompany, recommendedMaxAllocation } from "../presets.js";

export const getEmployerInputSchema = {
  ticker_or_name: z.string().min(1)
    .describe("Stock ticker or company name. Case-insensitive. Examples: 'NVDA', 'NVIDIA', 'tesla', 'Meta Platforms'."),
};

export type GetEmployerInput = {
  [K in keyof typeof getEmployerInputSchema]: z.infer<typeof getEmployerInputSchema[K]>;
};

export async function getEmployerHandler(args: GetEmployerInput) {
  const preset = findCompany(args.ticker_or_name);

  if (!preset) {
    return {
      content: [{
        type: "text" as const,
        text: `I don't have a preset for "${args.ticker_or_name}". ` +
              `Tell the user we recognize 40+ public tech employers — try the ticker (NVDA, TSLA, MSFT) or full name (NVIDIA, Tesla, Microsoft). ` +
              `If their employer is not on the list (private, smaller, non-tech), ask them for a best guess of the stock's annual volatility ` +
              `(e.g. 30% for stable, 50% for typical tech, 70%+ for crypto/highly speculative) and use 'myrsu_analyze_risk' with employer_volatility_pct instead.`,
      }],
      isError: true,
    };
  }

  if (preset.vol == null) {
    return {
      content: [{
        type: "text" as const,
        text: `"${preset.name}" is the manual-entry option. Ask the user for their employer's annual stock volatility ` +
              `as a percent (e.g. 50 for 50%) and pass that to 'myrsu_analyze_risk' as employer_volatility_pct.`,
      }],
      isError: true,
    };
  }

  const recMax = recommendedMaxAllocation(preset.vol);
  const drawdowns = preset.drawdowns || [];

  // Human-readable summary
  const lines: string[] = [];
  lines.push(`**${preset.name}** (${preset.ticker || "—"}) — ${preset.category}`);
  lines.push("");
  lines.push(`- Annual volatility (σ): **${(preset.vol * 100).toFixed(0)}%**`);
  lines.push(`- Recommended max concentration: **${(recMax * 100).toFixed(0)}% of net worth**`);
  if (drawdowns.length > 0) {
    lines.push("");
    lines.push("Historical drawdowns (peak-to-trough):");
    for (const d of drawdowns) {
      lines.push(`- **${d.year}** (${d.label}): −${(d.drop * 100).toFixed(0)}%`);
    }
  }
  lines.push("");
  lines.push(`_Approximate values. Past performance is not predictive. Source: MyRSU preset data._`);

  return {
    content: [{
      type: "text" as const,
      text: lines.join("\n"),
    }],
    structuredContent: {
      name: preset.name,
      ticker: preset.ticker,
      category: preset.category,
      annualVolatilityPct: Number((preset.vol * 100).toFixed(1)),
      recommendedMaxAllocationPct: Number((recMax * 100).toFixed(1)),
      historicalDrawdowns: drawdowns.map((d) => ({
        year: d.year,
        dropPct: Number((d.drop * 100).toFixed(1)),
        event: d.label,
      })),
    },
  };
}
