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

// ── Forecast Opportunities ───────────────────────────────────────────────────

export interface ForecastOpportunity {
  threat_type: string;
  primary_state: string;
  states_affected: string[];
  estimated_event_type: string;
  forecast_score: number;        // 0-1
  probability: number;           // 0-1
  risk_label: string;
  estimated_revenue: number;
  top_cities: Array<{ city: string; [key: string]: unknown }>;
}

export interface ForecastOpportunitiesResponse {
  opportunities: ForecastOpportunity[];
  count: number;
  generated_at?: string;
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

/** Matches actual backend response fields from storm_h3_clusters */
export interface CanvassCluster {
  h3: string;              // H3 hex index
  lat: number;
  lng: number;
  buildings: number;
  avg_value: number;       // Average property value USD
  roof_age: number;        // Average roof age in years
  distance_mi: number;     // Distance from storm center in miles
  priority: number;        // Priority score 0-1
  est_revenue: number;     // Estimated revenue USD
}

export interface CanvassClustersResponse {
  clusters: CanvassCluster[];
  count: number;
  storm_id: string;
  total_buildings: number;
}

// ── Neighborhood Targeting ───────────────────────────────────────────────────

export interface NeighborhoodCluster {
  zip: string;
  city: string;
  state: string;
  buildings: number;
  avg_value: number;
  roof_age: number;
  distance_mi: number;
  priority: number;        // Composite priority score 0-1
}

export interface NeighborhoodTargetingResponse {
  storm_id: string;
  center: { lat: number; lng: number };
  event_type?: string;
  magnitude?: number;
  clusters: NeighborhoodCluster[];
  total_buildings: number;
  sample_properties?: Array<{
    property_address?: string;
    zip_code?: string;
    owner_name?: string;
    year_built?: number;
    building_sqft?: number;
    [key: string]: unknown;
  }>;
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
  staleness_hours: number | null;
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
  | "storm.scored"          // New storm scored above partner's threshold
  | "storm.gold"            // Storm reaches Gold status (score ≥ 70)
  | "storm.updated"         // Existing storm re-scored, delta > 10 points
  | "properties.available"  // New property data in partner's territory
  | "pipeline.alert";       // Data ingestion pipeline issue

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
