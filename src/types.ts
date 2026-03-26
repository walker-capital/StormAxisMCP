/**
 * Response type definitions for the StormAxis Partner API.
 * These reflect the actual shapes returned by /api/v1/partner/* endpoints.
 */

// ── Storm Overview ───────────────────────────────────────────────────────────

export interface StateStormStat {
  state: string;
  storms: number;
  damage_usd: number;
}

export interface EventTypeCount {
  type: string;
  count: number;
}

export interface StormOverviewResponse {
  timestamp: string;
  period: string;
  active_storms: number;
  top_states: StateStormStat[];
  event_types: EventTypeCount[];
  data_freshness: string;
  api_version: string;
}

// ── Top Opportunities ────────────────────────────────────────────────────────

export interface StormOpportunity {
  storm_id: string;
  event_type: string;
  state: string;
  county: string | null;
  magnitude: number;
  opportunity_score: number;   // 0-100
  simulated_revenue: number;
  begin_time: string | null;
}

export interface TopOpportunitiesResponse {
  opportunities: StormOpportunity[];
  count: number;
  state?: string;
  min_score?: number;
}

// ── Storm Score ──────────────────────────────────────────────────────────────

export interface StormScoreResponse {
  noaa_event_key: string;
  opportunity_score: number;           // 0-100 composite
  storm_relevance_score?: number;      // Recency, magnitude, NWS confirmation
  property_economics_score?: number;   // Avg property value, roof age, density
  replacement_probability?: number;    // ML prediction 0-1
  event_type?: string;
  state?: string;
  magnitude?: number;
  begin_time?: string;
  simulated_revenue?: number;
}

// ── Property Search ──────────────────────────────────────────────────────────

export interface Property {
  zip_code: string;
  owner_name?: string;
  property_address?: string;
  building_sqft?: number;
  year_built?: number;
  assessed_value?: number;
  owner_type?: "individual" | "joint" | "entity";
  [key: string]: unknown;
}

export interface PropertySearchResponse {
  properties: Property[];
  count: number;
  zip_code: string;
}

// ── Canvass Clusters ─────────────────────────────────────────────────────────

export interface CanvassCluster {
  storm_event_id: string;
  h3_index: string;
  opportunity_score: number;
  property_count?: number;
  owner_occupancy_rate?: number;
  center_lat?: number;
  center_lng?: number;
  [key: string]: unknown;
}

export interface CanvassClustersResponse {
  clusters: CanvassCluster[];
  count: number;
  storm_id: string;
}

// ── Insurance Propensity ─────────────────────────────────────────────────────

export interface StatePropensity {
  state: string;
  claim_culture_score?: number;
  avg_payout_usd?: number;
  [key: string]: unknown;
}

export interface InsurancePropensityResponse {
  states: StatePropensity[];
  count: number;
}

// ── FEMA Claims ──────────────────────────────────────────────────────────────

export interface FemaClaimRecord {
  state: string;
  zip_code: string;
  total_claims: number;
  total_payout: number;
}

export interface FemaClaimsResponse {
  claims: FemaClaimRecord[];
  count: number;
}

// ── Pipeline Status ──────────────────────────────────────────────────────────

export interface DataSourceStatus {
  schedule: string;
  last_run?: string;
  status?: string;
}

export interface PipelineStatusResponse {
  pipeline_active: boolean;
  total_events: number;
  total_scored: number;
  latest_event_time: string | null;
  data_sources: {
    spc_reports: DataSourceStatus;
    nws_alerts: DataSourceStatus;
    mrms_hail: DataSourceStatus;
    scoring: DataSourceStatus;
  };
}

// ── Webhook Event Types (for reference) ──────────────────────────────────────

export type WebhookEventType =
  | "storm.scored"       // New storm scored above partner's threshold
  | "storm.gold"         // Storm reaches Gold status (score ≥ 70)
  | "storm.updated"      // Existing storm re-scored, delta > 10 points
  | "properties.available" // New property data in partner's territory
  | "pipeline.alert";    // Data ingestion pipeline issue

export interface WebhookPayload<T = unknown> {
  event: WebhookEventType;
  event_id: string;
  timestamp: string;
  data: T;
}

export interface StormScoredPayload {
  storm_id: string;
  event_type: string;
  state: string;
  county: string | null;
  magnitude: number;
  opportunity_score: number;
  simulated_revenue_usd: number;
  begin_time: string;
  affected_zips: string[];
  territory_match: boolean;
  territory_name?: string;
}
