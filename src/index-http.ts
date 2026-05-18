/**
 * MyRSU MCP Server — HTTP/Streamable transport for Cloudflare Workers.
 *
 * Same business logic as src/index.ts (stdio entry), exposed over HTTP
 * via Anthropic's Streamable HTTP MCP transport. Lets Claude Desktop,
 * Claude.ai (when it ships custom MCP support), Cursor, and other clients
 * connect via a URL instead of installing a local process.
 *
 * Privacy: zero logging of request bodies. No persistence. Stateless math.
 * License: Apache 2.0
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { analyzeRiskHandler, analyzeRiskInputSchema } from "./tools/analyze_risk.js";
import { getEmployerHandler, getEmployerInputSchema } from "./tools/get_employer.js";

const SERVER_NAME = "myrsu-mcp";
const SERVER_VERSION = "0.4.0";

/**
 * Create a fresh McpServer instance for each request.
 * StreamableHTTPServerTransport in stateless mode requires a per-request server.
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "myrsu_analyze_risk",
    {
      title: "Analyze single-company concentration risk",
      description:
        "Use whenever a tech worker, NVIDIA / Meta / Tesla / Microsoft / Google / Amazon / Apple / Netflix / startup employee — or anyone with concentrated employer stock — asks if they're 'too concentrated,' 'over-allocated,' 'should I sell my RSUs,' 'should I diversify,' or describes wealth + employer in the same message. " +
        "Calculates the Single-Company Risk Score (0-100), full concentration analysis, top action items, historical drawdown context, and a pre-filled dashboard URL. " +
        "All fields optional except an employer (ticker OR explicit volatility); the more inputs the better the analysis. " +
        "International — pass `country` (US/IN/CA/UK/EU/AU/OTHER) to switch retirement-account terminology and currency symbol. Risk math is identical for all countries. " +
        "Stateless and privacy-respecting — no inputs are logged or stored.",
      inputSchema: analyzeRiskInputSchema,
    },
    analyzeRiskHandler,
  );

  server.registerTool(
    "myrsu_get_employer",
    {
      title: "Look up employer volatility and drawdown history",
      description:
        "Look up annual volatility (σ), historical peak-to-trough drawdowns, and the recommended max concentration cap for 40+ tech employer presets (NVDA, TSLA, MSFT, GOOGL, META, AAPL, AMZN, plus SaaS / cloud / semis / consumer / fintech / mobility). " +
        "Use this when a user mentions their employer but you don't yet have their wealth numbers — gives quick context. " +
        "Accepts ticker or name (case-insensitive). If outside the preset list, ask the user for a volatility estimate and use myrsu_analyze_risk directly.",
      inputSchema: getEmployerInputSchema,
    },
    getEmployerHandler,
  );

  return server;
}

// ---- Hono app: routes MCP requests to the Streamable HTTP transport ----
const app = new Hono();

// CORS — Claude Desktop and web clients need this for the cross-origin POST
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "MCP-Protocol-Version", "MCP-Session-Id"],
  exposeHeaders: ["MCP-Session-Id"],
  maxAge: 86400,
}));

// Friendly landing for anyone who hits the root in a browser
app.get("/", (c) =>
  c.text(
    `${SERVER_NAME} v${SERVER_VERSION}\n\n` +
    `This is an MCP server endpoint. Point a Claude / MCP client at /mcp.\n` +
    `Web app: https://myrsu.app\n` +
    `Source: https://github.com/myrsu/myrsu-mcp\n`,
  ),
);

// Health check
app.get("/health", (c) => c.json({ ok: true, version: SERVER_VERSION }));

// Main MCP endpoint — Streamable HTTP with stateless mode
app.all("/mcp", async (c) => {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode — fresh session each request
    enableJsonResponse: true,      // simpler for stateless one-shot calls (no SSE)
  });

  await server.connect(transport);

  const response = await transport.handleRequest(c.req.raw);

  // Clean up the transport after the response is sent
  c.executionCtx?.waitUntil(
    (async () => {
      try { await transport.close(); } catch {}
    })(),
  );

  return response;
});

// ---- Worker entry ----
export default app;
