# StormAxis MCP Server

[![npm version](https://img.shields.io/npm/v/stormaxis-mcp.svg)](https://www.npmjs.com/package/stormaxis-mcp)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![API Status](https://img.shields.io/badge/API-live-brightgreen)](https://stormaxis.io/status)

**Give your AI agent real-time US storm intelligence.** StormAxis connects Claude, GPT, and any MCP-compatible agent to live NOAA storm data, scored contractor opportunities, property targeting lists, and canvass route optimization — purpose-built for roofing and restoration contractors.

---

## What it does

StormAxis watches every storm in the United States in real time. When a qualifying hail or wind event hits, it automatically scores it (0–100) based on severity, local property values, roof age, and historical claim rates — then surfaces the best opportunities to your agent.

Your AI agent can:
- Ask *"What are the best storm opportunities in Texas right now?"* and get a ranked list with estimated revenue
- Pull a property target list for any ZIP code hit by a scored storm
- Get H3-optimized canvass clusters so field crews know exactly where to knock doors first
- Check insurance claim propensity by state before committing resources to a new market
- Subscribe to webhooks that fire the moment a qualifying storm lands in your territory

---

## Quickstart

### 1. Get a Partner API key

Sign up at **[stormaxis.io/partner](https://stormaxis.io/partner)**. MCP access requires **Growth tier ($199/mo) or above**.

### 2. Add to Claude Code

```bash
claude mcp add stormaxis \
  --transport sse \
  --url https://stormaxis.io/api/mcp/sse \
  --header "X-API-Key: YOUR_API_KEY"
```

### 3. Make your first call

```
Ask Claude: "Check the StormAxis pipeline status."
```

You should see `pipeline_active: true` and a `latest_event_time` within the last 48 hours. You're live.

---

## Claude Desktop Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stormaxis": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://stormaxis.io/api/mcp/sse"],
      "env": {
        "MCP_REMOTE_HEADER_X_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

---

## Tool Reference

Full mapping of MCP tools to their underlying REST endpoints.

| MCP Tool | REST Endpoint | Tier | Parameters | Description |
|---|---|---|---|---|
| `get_storm_overview` | `GET /api/storm-intelligence/overview` | Growth | — | Real-time US storm snapshot — counts by type, top states, SPC outlook |
| `get_top_opportunities` | `GET /api/opportunity-radar/storm-events` | Growth | `state?` `min_score?` `limit?` | Last 30 days of storms ranked by opportunity score (0–100) |
| `get_storm_score` | `GET /api/stormstrike/target` | Growth | `storm_id` | Full composite score breakdown: storm relevance, property economics, replacement probability |
| `search_properties` | `GET /api/data-moat/parcels` | Professional | `zip_code` `owner_type?` `min_roof_age?` `min_sqft?` `limit?` | Owner + property records for door-knock targeting |
| `get_canvass_clusters` | `GET /api/stormstrike/canvass-clusters` | Professional | `storm_id` `min_score?` `limit?` | H3 hexagonal canvass zones ranked by doors/hour × owner-occupancy |
| `get_insurance_propensity` | `GET /api/storm-analytics/insurance-propensity-state` | Growth | `state?` | Claim culture score + avg payout per state |
| `get_fema_claims` | `GET /api/storm-analytics/fema-claims` | Professional | `state` `year_start?` `year_end?` | Historical NFIP flood claims aggregated by ZIP |
| `get_pipeline_status` | `GET /api/storm-intelligence/pipeline-status` | Growth | — | Data freshness and ingestion health check |

### Score Components (`get_storm_score`)

| Component | What it measures |
|---|---|
| `storm_relevance_score` | Recency, magnitude, NWS confirmation |
| `property_economics_score` | Avg property value, roof age, density |
| `replacement_probability` | ML prediction of claim conversion likelihood |

---

## Example Agent Workflows

### Daily Sales Briefing
```
1. get_storm_overview           → What's active nationally?
2. get_top_opportunities        → Which markets rank highest today?
3. get_insurance_propensity     → Which states convert claims best?
4. get_storm_score(top_id)      → Deep-dive on #1 opportunity
```

### Field Operations Planning
```
1. get_top_opportunities(state="TX")   → Identify top TX storm
2. get_canvass_clusters(storm_id)      → Get optimized zones
3. search_properties(zip_code)         → Pull door-knock list per zone
```

### New Market Assessment
```
1. get_insurance_propensity(state)               → How claim-friendly is this state?
2. get_fema_claims(state)                        → Historical flood risk by ZIP
3. get_top_opportunities(state, min_score=50)    → Any current opportunities?
```

---

## Pricing

| Tier | Price | Daily API Calls | MCP Access | Tools Available |
|---|---|---|---|---|
| **Sandbox** | Free | 100 | No | Dashboard only |
| **Growth** | $199/mo | 5,000 | Yes | `get_storm_overview`, `get_top_opportunities`, `get_storm_score`, `get_insurance_propensity`, `get_pipeline_status` |
| **Professional** | $499/mo | 25,000 | Yes | All 8 tools + Webhook add-on (+$99/mo) |
| **Enterprise** | $1,499+/mo | 100,000 | Yes | All tools + webhooks included + SLA + white-label |

Overage pricing: $0.05–$0.08 per 1,000 calls on Growth and above.

> **Webhook Subscriptions** are available as an add-on on Professional (+$99/mo) and are included on Enterprise. Webhooks fire in real time when a qualifying storm is detected in your monitored territories. See [/docs/webhooks.md](docs/webhooks.md).

---

## Error Reference

| Error | Cause |
|---|---|
| `Missing X-API-Key header` | No API key in request |
| `Invalid or inactive API key` | Key not found or revoked |
| `API key expired` | Key has passed expiration date |
| `MCP access requires Growth tier or above` | Sandbox key — upgrade at stormaxis.io/partner |
| `Daily limit of N calls reached` | Rate limit hit — resets midnight UTC |
| `Storm {id} not found` | Invalid or expired storm ID |
| `Database unavailable` | Transient backend error — retry with exponential backoff |

---

## Data Sources

| Source | Data Type | Refresh Frequency |
|---|---|---|
| NOAA/NWS Storm Data | Verified storm events | Continuous |
| SPC Convective Outlooks | Risk forecasts | Every 15 minutes |
| MRMS (Multi-Radar Multi-Sensor) | Hail size validation | Every 6 hours |
| US County Assessor Records | Property data | Monthly |
| FEMA NFIP Claims | Flood insurance history | Annual |

Storm opportunity scores are recomputed every 6 hours as new events are confirmed.

---

## Examples

- [Roofing Contractor Agent](examples/roofing-agent.md) — Identify storm hits in your territory and generate a lead list
- [Insurance Risk Assessment Agent](examples/insurance-agent.md) — Post-storm property risk assessment using parcel data and claim propensity
- [Dispatch Automation Agent](examples/dispatch-automation.md) — Auto-dispatch crews when a qualifying storm is detected via webhook

---

## Docs

- [Authentication & API Keys](docs/authentication.md)
- [Webhook Events](docs/webhooks.md)

---

## Support

- Partner Portal: [stormaxis.io/partner](https://stormaxis.io/partner)
- Documentation: [stormaxis.io/partner/docs](https://stormaxis.io/partner/docs)
- Issues: [tyler@stormaxis.io](mailto:tyler@stormaxis.io)
