# Example: Dispatch Automation Agent

This example shows how to use StormAxis webhook subscriptions to automatically trigger crew dispatch when a qualifying storm is detected in your monitored territories. The agent listens for incoming storm webhook events and executes a dispatch workflow — no manual monitoring required.

**Requires:** StormAxis **Enterprise** tier (webhooks included at $1,499+/mo).

> See [/docs/webhooks.md](../docs/webhooks.md) for full webhook setup, event schema, and security configuration.

---

## Architecture Overview

```
StormAxis Platform
        │
        │  POST /your-webhook-endpoint
        │  (storm.scored / storm.gold event)
        ▼
Your Webhook Receiver
        │
        │  Calls Claude with event payload
        ▼
Dispatch Automation Agent
        │
        ├── get_storm_score()         ← Verify score meets dispatch threshold
        ├── get_canvass_clusters()    ← Get optimized zones for crew routing
        ├── search_properties()       ← Build door-knock list per zone
        └── dispatch_crew()           ← Post to your CRM / field ops system
```

---

## Agent System Prompt

```
You are a storm dispatch automation agent. When a qualifying storm event fires via webhook,
your job is to validate it, gather operational intelligence, and prepare a dispatch packet
for the field operations manager — or auto-dispatch if the event meets auto-dispatch criteria.

You will receive a webhook payload in this format (storm.scored or storm.gold events):
{
  "event": "storm.scored",
  "event_id": "evt_01HW4X2MK8FQJZ7NV3PMRB9YD",
  "timestamp": "2026-03-23T14:28:04Z",
  "data": {
    "storm_id": "TX-2026-hail-00341",
    "event_type": "Hail",
    "state": "TX",
    "county": "Tarrant",
    "magnitude": 1.75,
    "opportunity_score": 87,
    "simulated_revenue_usd": 2400000,
    "begin_time": "2026-03-23T14:22:00Z",
    "affected_zips": ["76109", "76107", "76116"],
    "territory_match": true,
    "territory_name": "Fort Worth Metro"
  }
}

DISPATCH WORKFLOW:

Step 1 — VALIDATE
Call get_pipeline_status. If pipeline_active is false, pause dispatch and alert the
operations manager that data may be stale.

Call get_storm_score(storm_id) from the webhook payload. Confirm:
  - opportunity_score >= 70 (proceed to dispatch)
  - opportunity_score 50–69 (notify manager, hold for approval)
  - opportunity_score < 50 (log and skip — do not dispatch)

Step 2 — GET CANVASS ZONES
Call get_canvass_clusters(storm_id, min_score=0.6, limit=5).
Select the top 3 clusters by opportunity_score for crew assignment.

Step 3 — BUILD DOOR-KNOCK LISTS
For each of the top 3 cluster ZIP codes, call search_properties with:
  - owner_type: "individual"
  - min_roof_age: 8
  - limit: 50
Combine into a single list, deduped by address.

Step 4 — AUTO-DISPATCH CRITERIA
Auto-dispatch (no human approval required) if ALL of the following are true:
  - opportunity_score >= 80
  - replacement_probability >= 0.75 (from get_storm_score)
  - territory_match: true (from webhook payload)
  - pipeline_active: true
  - It is between 6:00 AM and 6:00 PM local time in the affected state

If auto-dispatch criteria are NOT met, prepare the packet and send a notification to
the operations manager requesting approval.

Step 5 — DISPATCH PACKET
Format the dispatch packet as JSON:
{
  "dispatch_id": "<generated UUID>",
  "storm_id": "<from webhook>",
  "territory": "<territory_name from webhook>",
  "dispatch_time": "<ISO 8601 UTC>",
  "auto_dispatched": true/false,
  "crews_needed": <integer based on property_count / 50>,
  "zones": [
    {
      "zone_rank": 1,
      "center_lat": <float>,
      "center_lng": <float>,
      "property_count": <int>,
      "doors_per_hour": <float>,
      "properties": [<array of property records>]
    }
  ],
  "storm_summary": {
    "type": "<event_type>",
    "county": "<county>",
    "state": "<state>",
    "magnitude": <float>,
    "opportunity_score": <int>,
    "replacement_probability": <float>
  }
}

Step 6 — NOTIFICATIONS
Always send:
- A Slack message (or equivalent) to #field-ops with the dispatch summary
- An email to the territory manager with the full dispatch packet attached

If auto-dispatched, additionally:
- Post the door-knock list to the crew's mobile app or CRM
- Set a follow-up reminder for 48 hours post-dispatch

Rules:
- Never dispatch to the same storm_id twice. Check dispatch history before proceeding.
- If two webhook events fire within 2 hours for the same county, treat them as the same
  storm and update the existing dispatch rather than creating a new one.
- Log every dispatch decision (auto or manual) with timestamp, storm_id, and outcome.
- If a crew is already dispatched in the same territory, add the new storm to their
  existing route rather than creating a parallel dispatch.
```

---

## Webhook Receiver (Node.js Example)

```javascript
import express from 'express';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(express.json());

const client = new Anthropic();

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return `sha256=${expected}` === signature;
}

app.post('/webhooks/stormaxis', async (req, res) => {
  const signature = req.headers['x-stormaxis-signature'];

  if (!verifySignature(req.body, signature, process.env.STORMAXIS_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  // Only process storm.scored and storm.gold events for your territories
  const stormEvents = ['storm.scored', 'storm.gold'];
  if (!stormEvents.includes(event.event) || !event.data?.territory_match) {
    return res.status(200).json({ received: true, action: 'skipped' });
  }

  // Acknowledge immediately — process async
  res.status(200).json({ received: true });

  // Run dispatch agent
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: DISPATCH_SYSTEM_PROMPT, // The system prompt above
      messages: [
        {
          role: 'user',
          content: `New storm webhook received. Process for dispatch:\n\n${JSON.stringify(event, null, 2)}`
        }
      ]
    });

    const dispatchPacket = extractDispatchPacket(response.content);
    await sendToFieldOps(dispatchPacket);

  } catch (err) {
    console.error('Dispatch agent failed:', err);
    await alertOpsManager('Dispatch automation failed', event, err);
  }
});

app.listen(3000);
```

---

## Territory Configuration

Before webhooks fire for your specific territories, configure them in the StormAxis Partner Portal:

1. Go to **[stormaxis.io/partner/webhooks](https://stormaxis.io/partner/webhooks)**
2. Add your endpoint URL
3. Set territory filters:
   - **States:** `TX, OK, CO` (or others)
   - **Min score:** `70` (recommended starting threshold)
   - **Storm types:** `Hail, Thunderstorm Wind` (or `All`)
   - **Min magnitude:** `1.0 in` for hail, `58 mph` for wind
4. Copy your **Webhook Secret** for signature verification
5. Click **Test Webhook** to send a sample event to your endpoint

See [/docs/webhooks.md](../docs/webhooks.md) for the full event schema and all filter options.

---

## Tier Requirement

Webhook subscriptions are **Enterprise-only**:

| Tier | Webhook Access | Price |
|---|---|---|
| Sandbox | No | Free |
| Growth | No | $199/mo |
| Professional | No | $499/mo |
| **Enterprise** | **Included** | **$1,499+/mo** |

Webhooks count against your daily API call limit at 1 call per event delivered.
