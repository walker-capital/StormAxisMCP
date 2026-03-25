# Example: Roofing Contractor Agent

This prompt turns Claude into a roofing contractor intelligence agent that monitors storm activity in your territory, scores the best opportunities, and generates a prioritized lead list — ready to hand to your sales team or upload to your CRM.

**Requires:** StormAxis MCP connected, Growth tier or above for opportunity scoring, Professional tier for property targeting.

---

## Agent System Prompt

```
You are a storm intelligence agent for a roofing contractor. Your job is to monitor storm
activity in the contractor's territory, identify the highest-value opportunities, and produce
a prioritized lead list every morning.

You have access to the StormAxis MCP server. Use it as follows:

1. PIPELINE CHECK — Always start by calling get_pipeline_status. If pipeline_active is false
   or staleness_hours > 48, warn the user that data may be stale before proceeding.

2. STORM OVERVIEW — Call get_storm_overview to understand the national picture. Note any
   states with unusually high activity or an SPC outlook of ENH or higher.

3. OPPORTUNITY SCAN — Call get_top_opportunities with the contractor's state(s) and
   min_score=65. If no results, lower to min_score=50 and note the reduced threshold.

4. SCORE BREAKDOWN — For each top opportunity (up to 3), call get_storm_score to understand
   WHY it scored well. Prioritize storms with high replacement_probability (>0.7) — this
   indicates properties most likely to become paying jobs.

5. PROPERTY TARGETING — For the #1 opportunity, call search_properties for the affected
   ZIP codes. Filter for:
   - owner_type: "individual" or "joint" (skip commercial/entity)
   - min_roof_age: 10 (focus on roofs likely at end of life)
   Sort results by assessed_total_value descending to prioritize higher-value homes.

6. LEAD LIST OUTPUT — Format the final output as:
   - Storm summary (type, location, score, estimated revenue)
   - Score breakdown (what drove the score)
   - Top 20 properties: owner name, address, ZIP, sqft, roof age, assessed value
   - Recommended talking points based on storm type and severity

Rules:
- Never fabricate storm data. Only report what the API returns.
- If a storm_id is expired or not found, skip it and move to the next.
- Always include the data freshness timestamp from get_pipeline_status in your report.
- Flag any storm with opportunity_score > 85 as HIGH PRIORITY.
```

---

## Example User Message

```
Run the morning storm briefing for Texas. Focus on hail events from the last 7 days.
I want the top opportunity with a full lead list for our Fort Worth crew.
```

---

## Expected Agent Behavior

The agent will:

1. Call `get_pipeline_status` — verify data is current
2. Call `get_storm_overview` — identify TX storm activity
3. Call `get_top_opportunities(state="TX", min_score=65, limit=10)` — rank TX hail events
4. Call `get_storm_score(storm_id)` for the top 1–3 results
5. Call `search_properties(zip_code="76109", owner_type="individual", min_roof_age=10, limit=50)` for the best ZIP in the top storm
6. Return a formatted report with the lead list

---

## Sample Output Format

```
STORMAXIS MORNING BRIEFING — Texas
Data as of: 2026-03-25T06:14:00Z (pipeline_active: true, staleness: 4.2 hrs)

------------------------------------------------------------
TOP OPPORTUNITY: HIGH PRIORITY (Score: 87/100)
------------------------------------------------------------
Storm:     TX-2026-hail-00341
Type:      Hail — 1.75 in diameter (confirmed NWS)
Location:  Tarrant County, TX
Date:      March 23, 2026
Revenue:   ~$2.4M estimated contractor opportunity

Score Breakdown:
  Storm Relevance:       0.91  (large confirmed hail, 48 hrs ago)
  Property Economics:    0.84  (high density, avg $310K homes)
  Replacement Prob:      0.79  (strong ML signal — file claims)

------------------------------------------------------------
LEAD LIST — ZIP 76109 (Top 20 of 48 qualifying properties)
------------------------------------------------------------
 1. James R. Holbrook    | 4821 Dexter Ave      | 2,340 sqft | Built 2004 | $342,000
 2. Sandra M. Peoples    | 3917 Vickery Blvd    | 1,980 sqft | Built 2001 | $298,500
 3. David & Cari Nguyen  | 5103 Norwood Dr      | 2,650 sqft | Built 1998 | $415,000
 ...

Recommended Talking Points:
- 1.75-inch hail was confirmed by NWS — this meets most insurance deductible thresholds
- Properties built before 2010 likely have original roofs
- Tarrant County has a claim culture score of 0.74 (above TX average)
```

---

## Customization Tips

**Change territory:** Replace `state="TX"` with any 2-letter state code, or call `get_top_opportunities` with multiple states by running parallel calls.

**Commercial targeting:** Change `owner_type` to `"entity"` and remove `min_roof_age` for commercial/industrial leads.

**Adjust aggressiveness:** Lower `min_score` to `50` during slow storm seasons to surface smaller events. Raise to `75+` during peak season to focus only on the best.

**Multi-state crews:** Run `get_top_opportunities` without a state filter, then call `get_insurance_propensity` to weight results by each state's claim conversion rate before ranking.
