#!/usr/bin/env node
/**
 * StormAxis MCP Server
 *
 * Standalone TypeScript MCP server that proxies tool calls to the StormAxis
 * Partner REST API. Requires STORMAXIS_API_KEY environment variable.
 *
 * Transport: stdio (default) or SSE via https://stormaxis.io/api/mcp/sse
 *
 * Usage:
 *   STORMAXIS_API_KEY=sa_xxx npx stormaxis-mcp
 *
 * Claude Code:
 *   claude mcp add stormaxis --transport sse \
 *     --url https://stormaxis.io/api/mcp/sse \
 *     --header "X-API-Key: YOUR_API_KEY"
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type {
  StormOverviewResponse,
  TopOpportunitiesResponse,
  StormScoreResponse,
  PropertySearchResponse,
  CanvassClustersResponse,
  InsurancePropensityResponse,
  FemaClaimsResponse,
  PipelineStatusResponse,
} from "./types.js";

// ── Config ──────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.STORMAXIS_API_BASE ?? "https://stormaxis.io/api";
const API_KEY = process.env.STORMAXIS_API_KEY;

if (!API_KEY) {
  process.stderr.write(
    "[stormaxis-mcp] Error: STORMAXIS_API_KEY environment variable is required.\n" +
    "Get a key at https://stormaxis.io/partner (Growth tier or above required for MCP)\n"
  );
  process.exit(1);
}

// ── HTTP Client ──────────────────────────────────────────────────────────────

async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY!,
      "Content-Type": "application/json",
      "User-Agent": "stormaxis-mcp/1.0.0",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body;
    try {
      const json = JSON.parse(body);
      message = json.detail ?? json.message ?? json.error ?? body;
    } catch {
      // use raw body
    }
    throw new McpError(
      res.status === 401 || res.status === 403
        ? ErrorCode.InvalidRequest
        : ErrorCode.InternalError,
      `StormAxis API error ${res.status}: ${message}`
    );
  }

  return res.json() as Promise<T>;
}

// ── Input Schemas (Zod) ──────────────────────────────────────────────────────

const GetTopOpportunitiesSchema = z.object({
  state: z
    .string()
    .length(2)
    .toUpperCase()
    .optional()
    .describe("2-letter US state code (e.g. 'TX')"),
  min_score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .default(60)
    .describe("Minimum opportunity score 0-100. Default 60."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Max results. Default 10, max 50."),
});

const GetStormScoreSchema = z.object({
  storm_id: z.string().min(1).describe("Storm noaa_event_key or episode ID"),
});

const SearchPropertiesSchema = z.object({
  zip_code: z
    .string()
    .regex(/^\d{5}$/, "Must be 5-digit ZIP code")
    .describe("5-digit US ZIP code (e.g. '76109')"),
  owner_type: z
    .enum(["individual", "joint", "entity"])
    .optional()
    .describe("Filter by owner type"),
  min_roof_age: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Minimum roof age in years"),
  min_sqft: z.number().int().min(1).optional().describe("Minimum building sqft"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Max results. Default 50, max 100."),
});

const GetCanvassClustersSchema = z.object({
  storm_id: z.string().min(1).describe("Storm episode ID"),
  min_score: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("Min cluster score 0-1. Default 0.5."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Max clusters. Default 10."),
});

const GetInsurancePropensitySchema = z.object({
  state: z
    .string()
    .length(2)
    .toUpperCase()
    .optional()
    .describe("2-letter state code. Optional — omit for all states."),
});

const GetFemaClaimsSchema = z.object({
  state: z
    .string()
    .length(2)
    .toUpperCase()
    .describe("2-letter state code (required)"),
  year_start: z
    .number()
    .int()
    .min(1900)
    .max(2030)
    .default(2015)
    .describe("Start year. Default 2015."),
  year_end: z
    .number()
    .int()
    .min(1900)
    .max(2030)
    .default(2026)
    .describe("End year. Default 2026."),
});

// ── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_storm_overview",
    description:
      "Get a real-time overview of active storm activity across the US. " +
      "Returns active storm counts by type (hail, tornado, wind, flood), " +
      "top affected states, and current SPC convective outlook level. " +
      "Updated every 15 minutes. Use this as a starting point before drilling into opportunities.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_top_opportunities",
    description:
      "Get top-scored storm opportunities from the last 30 days. " +
      "Returns storms ranked by opportunity score (0-100) with revenue estimates, " +
      "affected property counts, and storm classification. Requires Growth tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "Filter by 2-letter state code (e.g. 'TX', 'OK'). Optional.",
        },
        min_score: {
          type: "number",
          description: "Minimum opportunity score 0-100. Default 60.",
          default: 60,
        },
        limit: {
          type: "number",
          description: "Max results. Default 10, max 50.",
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: "get_storm_score",
    description:
      "Get the detailed opportunity score breakdown for a specific storm. " +
      "Returns composite score (0-100) with components: storm_relevance_score (recency, magnitude, NWS confirmation), " +
      "property_economics_score (avg property value, roof age, density), " +
      "and replacement_probability (ML prediction). Requires Growth tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        storm_id: {
          type: "string",
          description: "Storm noaa_event_key or episode ID from get_top_opportunities.",
        },
      },
      required: ["storm_id"],
    },
  },
  {
    name: "search_properties",
    description:
      "Search the property database for targetable properties in a ZIP code. " +
      "Returns owner name, property address, building sqft, roof age estimate, property value, and owner type. " +
      "Use to build door-knock lists for canvassing after a storm. Requires Professional tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zip_code: {
          type: "string",
          description: "5-digit US ZIP code (e.g. '76109').",
        },
        owner_type: {
          type: "string",
          enum: ["individual", "joint", "entity"],
          description: "Filter by owner type. Optional.",
        },
        min_roof_age: {
          type: "number",
          description: "Minimum roof age in years. Optional.",
        },
        min_sqft: {
          type: "number",
          description: "Minimum building square footage. Optional.",
        },
        limit: {
          type: "number",
          description: "Max results. Default 50, max 100.",
          default: 50,
        },
      },
      required: ["zip_code"],
    },
  },
  {
    name: "get_canvass_clusters",
    description:
      "Get optimized canvass clusters for a storm event using H3 hexagonal grid indexing. " +
      "Clusters are ranked by canvass efficiency (doors/hour × owner-occupancy rate). " +
      "Returns center coordinates, property count, and cluster score. Requires Professional tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        storm_id: {
          type: "string",
          description: "Storm episode ID from get_top_opportunities.",
        },
        min_score: {
          type: "number",
          description: "Min cluster score 0-1. Default 0.5.",
          default: 0.5,
        },
        limit: {
          type: "number",
          description: "Max clusters. Default 10.",
          default: 10,
        },
      },
      required: ["storm_id"],
    },
  },
  {
    name: "get_insurance_propensity",
    description:
      "Get insurance claim propensity data by US state. " +
      "Returns claim culture scores showing how likely property owners are to file claims after storm damage. " +
      "Higher scores = more claim-friendly = better conversion for contractors. Requires Growth tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "Filter to a specific 2-letter state code. Omit for all states.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_fema_claims",
    description:
      "Get historical FEMA NFIP flood insurance claims for a state. " +
      "Returns aggregated claim frequency and dollar amounts by ZIP code and year range. " +
      "Use to evaluate flood risk when entering a new market. Requires Professional tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "2-letter state code (required, e.g. 'TX').",
        },
        year_start: {
          type: "number",
          description: "Start year. Default 2015.",
          default: 2015,
        },
        year_end: {
          type: "number",
          description: "End year. Default 2026.",
          default: 2026,
        },
      },
      required: ["state"],
    },
  },
  {
    name: "get_pipeline_status",
    description:
      "Check the health and data freshness of the StormAxis ingestion pipeline. " +
      "Returns last ingestion timestamps per source, total event counts, and staleness indicators. " +
      "Call this to verify data is current before making field deployment decisions. Requires Growth tier.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const;

// ── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = [
  {
    name: "storm_assessment",
    description:
      "Generate a complete storm intelligence briefing for a US state. " +
      "Chains: overview → top opportunities → score breakdown → property targeting.",
    arguments: [
      {
        name: "state",
        description: "2-letter US state code (e.g. 'TX'). Default: TX.",
        required: false,
      },
    ],
  },
  {
    name: "property_search",
    description:
      "Search for targetable properties in a ZIP code with storm context. " +
      "Checks active storm activity nearby, then finds properties with older roofs.",
    arguments: [
      {
        name: "zip_code",
        description: "5-digit US ZIP code. Default: 76109.",
        required: false,
      },
    ],
  },
];

// ── Tool Handlers ────────────────────────────────────────────────────────────

async function handleTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "get_storm_overview": {
      const data = await apiGet<StormOverviewResponse>(
        "/v1/partner/storm/overview"
      );
      return JSON.stringify(data, null, 2);
    }

    case "get_top_opportunities": {
      const input = GetTopOpportunitiesSchema.parse(args);
      const data = await apiGet<TopOpportunitiesResponse>(
        "/v1/partner/opportunities/top",
        {
          state: input.state,
          min_score: input.min_score,
          limit: input.limit,
        }
      );
      return JSON.stringify(data, null, 2);
    }

    case "get_storm_score": {
      const input = GetStormScoreSchema.parse(args);
      const data = await apiGet<StormScoreResponse>(
        `/v1/partner/storm/${encodeURIComponent(input.storm_id)}/score`
      );
      return JSON.stringify(data, null, 2);
    }

    case "search_properties": {
      const input = SearchPropertiesSchema.parse(args);
      const data = await apiGet<PropertySearchResponse>(
        `/v1/partner/properties/${encodeURIComponent(input.zip_code)}`,
        {
          owner_type: input.owner_type,
          min_roof_age: input.min_roof_age,
          min_sqft: input.min_sqft,
          limit: input.limit,
        }
      );
      return JSON.stringify(data, null, 2);
    }

    case "get_canvass_clusters": {
      const input = GetCanvassClustersSchema.parse(args);
      const data = await apiGet<CanvassClustersResponse>(
        `/v1/partner/clusters/${encodeURIComponent(input.storm_id)}`,
        {
          min_score: input.min_score,
          limit: input.limit,
        }
      );
      return JSON.stringify(data, null, 2);
    }

    case "get_insurance_propensity": {
      const input = GetInsurancePropensitySchema.parse(args);
      const data = await apiGet<InsurancePropensityResponse>(
        "/v1/partner/analytics/insurance-propensity",
        { state: input.state }
      );
      return JSON.stringify(data, null, 2);
    }

    case "get_fema_claims": {
      const input = GetFemaClaimsSchema.parse(args);
      const data = await apiGet<FemaClaimsResponse>(
        "/v1/partner/fema/claims",
        {
          state: input.state,
          year_start: input.year_start,
          year_end: input.year_end,
        }
      );
      return JSON.stringify(data, null, 2);
    }

    case "get_pipeline_status": {
      const data = await apiGet<PipelineStatusResponse>(
        "/v1/partner/pipeline/status"
      );
      return JSON.stringify(data, null, 2);
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}

// ── Prompt Handlers ──────────────────────────────────────────────────────────

function handlePrompt(
  name: string,
  args: Record<string, string>
): { role: "user"; content: { type: "text"; text: string } } {
  switch (name) {
    case "storm_assessment": {
      const state = args.state ?? "TX";
      return {
        role: "user",
        content: {
          type: "text",
          text:
            `Give me a complete storm assessment for ${state}. ` +
            `Start with the current US overview using get_storm_overview, ` +
            `then show the top opportunities for ${state} using get_top_opportunities with state="${state}", ` +
            `then drill into the #1 ranked opportunity using get_storm_score for the full score breakdown, ` +
            `and finally use search_properties on the best ZIP in that storm's area to generate a canvass lead list.`,
        },
      };
    }

    case "property_search": {
      const zip = args.zip_code ?? "76109";
      return {
        role: "user",
        content: {
          type: "text",
          text:
            `Find targetable properties in ZIP code ${zip}. ` +
            `First use get_storm_overview to check if there is active storm activity nearby. ` +
            `Then use search_properties with zip_code="${zip}" and min_roof_age=15 ` +
            `to find older-roof properties. Summarize the lead opportunity in plain English.`,
        },
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${name}`);
  }
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "stormaxis-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    const result = await handleTool(name, args as Record<string, unknown>);
    return {
      content: [{ type: "text", text: result }],
    };
  } catch (err) {
    if (err instanceof McpError) throw err;
    if (err instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw new McpError(
      ErrorCode.InternalError,
      err instanceof Error ? err.message : String(err)
    );
  }
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const message = handlePrompt(name, args as Record<string, string>);
  return { messages: [message] };
});

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[stormaxis-mcp] Server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[stormaxis-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
