# Authentication & API Keys

All StormAxis API and MCP requests require a Partner API key passed as the `X-API-Key` header.

---

## Getting a Key

1. Sign up at **[stormaxis.io/partner](https://stormaxis.io/partner)**
2. Select a tier (Growth or above for MCP access)
3. Your API key is displayed immediately on the dashboard — copy it now, it won't be shown again in full

Keys are in the format: `sa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

Sandbox keys follow the format: `sa_sandbox_xxxxxxxx` — these are rejected at MCP connection time.

---

## Using Your Key

### Claude Code (recommended)

```bash
claude mcp add stormaxis \
  --transport sse \
  --url https://stormaxis.io/api/mcp/sse \
  --header "X-API-Key: YOUR_API_KEY"
```

### Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Direct REST API

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://stormaxis.io/api/storm-intelligence/overview
```

### Environment Variable (Node.js)

```javascript
const response = await fetch('https://stormaxis.io/api/storm-intelligence/overview', {
  headers: {
    'X-API-Key': process.env.STORMAXIS_API_KEY
  }
});
```

Never hardcode API keys in source files. Always use environment variables or a secrets manager.

---

## Tier Comparison

| Feature | Sandbox | Growth | Professional | Enterprise |
|---|---|---|---|---|
| **Price** | Free | $199/mo | $499/mo | $1,499+/mo |
| **Daily API Calls** | 100 | 5,000 | 25,000 | 100,000 |
| **MCP Access** | No | Yes | Yes | Yes |
| **`get_storm_overview`** | Dashboard only | Yes | Yes | Yes |
| **`get_top_opportunities`** | No | Yes | Yes | Yes |
| **`get_storm_score`** | No | Yes | Yes | Yes |
| **`get_insurance_propensity`** | No | Yes | Yes | Yes |
| **`get_pipeline_status`** | No | Yes | Yes | Yes |
| **`search_properties`** | No | No | Yes | Yes |
| **`get_canvass_clusters`** | No | No | Yes | Yes |
| **`get_fema_claims`** | No | No | Yes | Yes |
| **Webhook Subscriptions** | No | No | Add-on (+$99/mo) | Included |
| **SLA** | No | No | No | Yes |
| **White-label** | No | No | No | Yes |
| **Dedicated Support** | No | No | No | Yes |

Overage is billed at $0.05–$0.08 per 1,000 calls on Growth and above.

---

## Key Management

### Rotating a Key

1. Go to **[stormaxis.io/partner/keys](https://stormaxis.io/partner/keys)**
2. Click **Rotate** next to the active key
3. A new key is issued immediately
4. The old key remains valid for **24 hours** to allow zero-downtime rotation
5. Update all integrations before the 24-hour grace period expires

### Multiple Keys

Professional and Enterprise tiers support multiple API keys. Use separate keys for:
- Production vs. staging environments
- Different field offices or sub-accounts
- Webhook receivers vs. MCP agents

### Revoking a Key

Go to the Partner Portal → **Keys** → **Revoke**. Revocation is immediate — no grace period.

---

## Error Responses

| Status | Body | Cause |
|---|---|---|
| `401` | `Missing X-API-Key header` | No key in request |
| `401` | `Invalid or inactive API key` | Key not found or revoked |
| `401` | `API key expired` | Key past expiration date |
| `403` | `MCP access requires Growth tier or above` | Sandbox key attempting MCP connection |
| `429` | `Daily limit of N calls reached` | Rate limit hit — resets midnight UTC |

---

## Security Best Practices

- Store keys in environment variables or a secrets manager (AWS Secrets Manager, 1Password, etc.)
- Never commit keys to source control — add `.env` to `.gitignore`
- Use separate keys per environment (production, staging, development)
- Rotate keys on a schedule or immediately after any suspected exposure
- For webhook endpoints, always verify the `X-StormAxis-Signature` header — see [webhooks.md](webhooks.md)

---

## Support

- Partner Portal: [stormaxis.io/partner](https://stormaxis.io/partner)
- Key issues: [tyler@stormaxis.io](mailto:tyler@stormaxis.io)
