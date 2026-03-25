# Webhook Events

StormAxis webhooks push real-time storm notifications to your endpoint the moment a qualifying event is detected in your monitored territories — no polling required.

**Availability:**
- Professional tier: Add-on at **+$99/mo**
- Enterprise tier: **Included**

---

## Setup

### 1. Enable the add-on (Professional only)

Go to **[stormaxis.io/partner/billing](https://stormaxis.io/partner/billing)** → Add-ons → Enable **Storm Webhooks** (+$99/mo). Enterprise accounts skip this step.

### 2. Register your endpoint

Go to **[stormaxis.io/partner/webhooks](https://stormaxis.io/partner/webhooks)** → **Add Endpoint**.

Requirements for your endpoint:
- Must be HTTPS (HTTP endpoints are rejected)
- Must respond with `2xx` within **10 seconds**
- Must be publicly reachable (no localhost or private IPs)

### 3. Configure territory filters

| Filter | Options | Description |
|---|---|---|
| **States** | Any US state codes | Only fire for events in these states |
| **Min opportunity score** | 0–100 (recommended: 65+) | Skip events below this score |
| **Storm types** | Hail, Tornado, Thunderstorm Wind, Flood, All | Filter by event classification |
| **Min hail size** | Inches (e.g., 1.0) | Only trigger on significant hail |
| **Min wind speed** | MPH (e.g., 58) | Only trigger on damaging wind |

### 4. Copy your webhook secret

After saving, copy the **Webhook Secret** from the endpoint detail page. You'll use this to verify signatures. It is only shown once — store it securely.

### 5. Test the endpoint

Click **Test Webhook** to send a sample `storm.qualified` payload to your endpoint. Verify you receive it and return a `200` response.

---

## Event Types

| Event | When it fires |
|---|---|
| `storm.qualified` | A storm in your territory meets your configured score and magnitude thresholds |
| `storm.updated` | An existing qualified storm's score has been recomputed and changed by ≥10 points |
| `storm.expired` | A storm event has aged out of the active window (>30 days) |
| `pipeline.stale` | The data pipeline has not ingested new events in >48 hours |

---

## Event Payload Schema

### `storm.qualified`

```json
{
  "event": "storm.qualified",
  "event_id": "evt_01HW4X2MK8FQJZ7NV3PMRB9YD",
  "timestamp": "2026-03-23T14:28:04Z",
  "storm_id": "TX-2026-hail-00341",
  "event_type": "Hail",
  "state": "TX",
  "county": "Tarrant",
  "magnitude": 1.75,
  "magnitude_unit": "inches",
  "opportunity_score": 87,
  "simulated_revenue_usd": 2400000,
  "begin_time": "2026-03-23T14:22:00Z",
  "affected_zips": ["76109", "76107", "76116"],
  "territory_match": true,
  "territory_name": "Fort Worth Metro",
  "pipeline_staleness_hours": 0.1
}
```

### `storm.updated`

```json
{
  "event": "storm.updated",
  "event_id": "evt_01HW5Y3NL9GRKA8OW4QNSC0ZE",
  "timestamp": "2026-03-23T20:14:00Z",
  "storm_id": "TX-2026-hail-00341",
  "previous_score": 74,
  "current_score": 87,
  "score_delta": 13,
  "reason": "MRMS hail validation updated magnitude from 1.25 to 1.75 inches"
}
```

### `storm.expired`

```json
{
  "event": "storm.expired",
  "event_id": "evt_01HW6Z4OM0HSLB9PX5ROTD1AF",
  "timestamp": "2026-04-22T14:22:00Z",
  "storm_id": "TX-2026-hail-00341",
  "final_score": 87,
  "days_active": 30
}
```

### `pipeline.stale`

```json
{
  "event": "pipeline.stale",
  "event_id": "evt_01HW7A5PN1ITMCAQY6SUPE2BG",
  "timestamp": "2026-03-25T10:00:00Z",
  "staleness_hours": 52.3,
  "last_event_time": "2026-03-23T05:41:00Z",
  "affected_sources": ["SPC", "NWS"]
}
```

---

## Payload Fields Reference

| Field | Type | Description |
|---|---|---|
| `event` | string | Event type (see Event Types above) |
| `event_id` | string | Unique event ID — use for idempotency |
| `timestamp` | ISO 8601 | When the event was fired |
| `storm_id` | string | Unique storm identifier — use with MCP tools |
| `event_type` | string | `Hail`, `Tornado`, `Thunderstorm Wind`, `Flood` |
| `state` | string | 2-letter state code |
| `county` | string | Affected county name |
| `magnitude` | number | Hail size (inches) or wind speed (MPH) |
| `opportunity_score` | integer | Composite score 0–100 at time of event |
| `simulated_revenue_usd` | number | Estimated contractor revenue |
| `affected_zips` | string[] | ZIP codes within the storm footprint |
| `territory_match` | boolean | True if the event matches your territory filters |
| `territory_name` | string | Name of the matched territory configuration |

---

## Signature Verification

Every webhook request includes an `X-StormAxis-Signature` header. Always verify this before processing the payload.

**Header format:** `sha256=<hmac-sha256-hex-digest>`

The digest is computed as: `HMAC-SHA256(webhook_secret, JSON.stringify(request_body))`

### Node.js

```javascript
import crypto from 'crypto';

function verifySignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return `sha256=${expected}` === signature;
}

// In your Express handler — use raw body, not parsed JSON
app.post('/webhooks/stormaxis', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-stormaxis-signature'];

  if (!verifySignature(req.body, sig, process.env.STORMAXIS_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  // process event...
  res.status(200).json({ received: true });
});
```

### Python

```python
import hmac
import hashlib
import json

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return f"sha256={expected}" == signature

# In your Flask/FastAPI handler
@app.post("/webhooks/stormaxis")
async def handle_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-stormaxis-signature")

    if not verify_signature(raw_body, signature, os.environ["STORMAXIS_WEBHOOK_SECRET"]):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = json.loads(raw_body)
    # process event...
    return {"received": True}
```

---

## Delivery & Retries

| Behavior | Details |
|---|---|
| **Timeout** | 10 seconds per attempt |
| **Retry schedule** | 5s → 30s → 2m → 10m → 1h (5 attempts total) |
| **Retry trigger** | Any non-2xx response or connection failure |
| **Idempotency** | Use `event_id` to deduplicate retried events |
| **Ordering** | Events are delivered roughly in order, not guaranteed |
| **Expiry** | Events that fail all 5 attempts are dropped and logged in the portal |

### Delivery Logs

All delivery attempts are logged in the Partner Portal under **Webhooks → Delivery Log** for 7 days. You can manually replay any failed event from the log.

---

## Best Practices

**Always acknowledge immediately.** Return a `200` within 10 seconds, then process the event asynchronously. Heavy processing in the handler will cause timeouts and retries.

**Use `event_id` for idempotency.** Store processed event IDs to prevent duplicate processing from retries.

**Verify signatures.** Skip this and you're open to spoofed events triggering unwanted dispatches.

**Handle `storm.updated` carefully.** A score revision of +10 or more may warrant a dispatch escalation; a downward revision may warrant pulling back crews.

**Monitor `pipeline.stale` events.** If data is stale, any storm data your agents are acting on may be outdated. Consider pausing automated dispatch until the pipeline recovers.

---

## Endpoint Management

| Action | Where |
|---|---|
| Add / remove endpoints | Partner Portal → Webhooks |
| View delivery logs | Partner Portal → Webhooks → Delivery Log |
| Rotate webhook secret | Portal → Endpoint → Rotate Secret |
| Test an endpoint | Portal → Endpoint → Send Test Event |
| Pause deliveries | Portal → Endpoint → Pause (events are queued for 24h) |

---

## Support

- Webhook issues: [tyler@stormaxis.io](mailto:tyler@stormaxis.io)
- Partner Portal: [stormaxis.io/partner](https://stormaxis.io/partner)
