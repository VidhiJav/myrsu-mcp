#!/usr/bin/env node
/**
 * MyRSU MCP Server
 * https://myrsu.app
 *
 * Exposes two tools to AI assistants (Claude, Cursor, Continue, Cline, etc.):
 *   - myrsu_analyze_risk     — full concentration-risk analysis given user wealth/income/employer
 *   - myrsu_get_employer     — quick lookup of σ + historical drawdowns for 40+ tech employers
 *
 * Privacy: stateless. No persistence, no logging, no external API calls.
 * License: Apache 2.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { analyzeRiskHandler, analyzeRiskInputSchema } from "./tools/analyze_risk.js";
import { getEmployerHandler, getEmployerInputSchema } from "./tools/get_employer.js";

const SERVER_NAME = "myrsu-mcp";
const SERVER_VERSION = "0.4.0";

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // ---- Tool: myrsu_analyze_risk ------------------------------------------
  server.registerTool(
    "myrsu_analyze_risk",
    {
      title: "Analyze single-company concentration risk",
      description:
        "Calculate the Single-Company Risk Score (0-100) and full concentration analysis for a tech worker with significant RSU comp. " +
        "Returns risk score, concentration %, wealth-at-risk, diversification gap, top action items, and a pre-filled dashboard URL. " +
        "Use this whenever someone describes their wealth, employer, and stock holdings and wants to know how risky their setup is. " +
        "All fields are optional except an employer (ticker OR explicit volatility), but the more inputs provided, the more accurate the analysis. " +
        "International — pass `country` (US/IN/CA/UK/EU/AU/OTHER) to switch retirement-account terminology and currency symbol. The risk math is identical for all countries. " +
        "Stateless and privacy-first — no data leaves the local calculation.",
      inputSchema: analyzeRiskInputSchema,
    },
    analyzeRiskHandler,
  );

  // ---- Tool: myrsu_get_employer ------------------------------------------
  server.registerTool(
    "myrsu_get_employer",
    {
      title: "Look up employer volatility and drawdown history",
      description:
        "Look up annual volatility (σ), historical peak-to-trough drawdowns, and the recommended max concentration cap " +
        "for any of 40+ tech employer presets (NVDA, TSLA, MSFT, GOOGL, META, AAPL, AMZN, plus SaaS / cloud / semis / consumer / fintech / mobility). " +
        "Use this when a user mentions their employer but you don't yet have their wealth numbers — gives quick context. " +
        "Accepts ticker or name (case-insensitive). Returns 'not found' if outside the preset list; in that case ask the user for a volatility estimate and use myrsu_analyze_risk directly.",
      inputSchema: getEmployerInputSchema,
    },
    getEmployerHandler,
  );

  // ---- Connect transport -------------------------------------------------
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP servers run silently. No console.log on stdout (would corrupt the protocol).
  // Use stderr for any boot messages.
  console.error(`[${SERVER_NAME} ${SERVER_VERSION}] Connected via stdio.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
