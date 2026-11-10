export interface AskResult {
  answer: string;
  sources: string[];
  validation: string;
  citations?: Citation[];
}
export interface Citation { chunk_id: string; doc_id: string; filename: string; page: number | null; excerpt: string }

export interface DocumentMeta {
  filename: string;
  chunks: number;
  extension: string;
  size_chars: number;
}

export interface Capabilities {
  supported_extensions: string[];
  max_upload_bytes: number;
  max_upload_mb: number;
  llm_model: string;
  nvidia_configured: boolean;
  session_ttl_seconds: number;
  persistence: string;
  features: string[];
}

export interface Health {
  status: string;
  app: string;
  nvidia_configured: boolean;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  validation?: string;
  error?: boolean;
  citations?: Citation[];
}

export interface IntelDocument {
  doc_id: string;
  filename: string;
  extension: string;
  version: number;
  status: string;
  extraction_status: string;
  extraction_error: string | null;
  chunks: number;
  created_at?: number | null;
  size_bytes?: number | null;
  source_available?: boolean;
  index_available?: boolean;
  recorded_chunks?: number;
  key_topics?: string[];
  summary?: string | null;
  entity_count?: number;
}

export interface IntelFact {
  fact_id: string;
  doc_id: string;
  filename: string;
  subject: string;
  attribute: string;
  value: string;
  value_type: string;
  unit: string | null;
  period: string | null;
  entity_id: string | null;
  evidence: string;
  char_start: number | null;
  char_end: number | null;
  status: string;
  validation_notes: string;
}

export interface IntelEntity {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  aliases: string[];
  status: string;
  fact_count: number;
}

export interface IntelRelationship {
  rel_id: string;
  src_entity_id: string;
  rel_type: string;
  dst_entity_id: string;
  doc_id: string;
  evidence: string;
  status: string;
}

export interface IntelCompareResponse {
  matching: boolean;
  conflict: boolean;
  category: string;
  explanation: string;
  preserved: Record<string, unknown>;
}

export interface ComparedClaimPair {
  claim_a: IntelFact;
  claim_b: IntelFact;
  explanation: string;
}

export interface IntelCompareDocsResponse {
  doc_a: string;
  doc_b: string;
  matches: ComparedClaimPair[];
  conflicts: ComparedClaimPair[];
  unique_a: IntelFact[];
  unique_b: IntelFact[];
  summary: string;
}

export interface IntelContradictResponse {
  conflicts: Record<string, unknown>[];
}

export interface IntelContradictStatsResponse {
  session_id: string;
  /** Stats endpoint: total contradictions stored */
  total?: number;
  /** Stats endpoint: open contradictions */
  open?: number;
  /** Stats endpoint: resolved contradictions */
  resolved?: number;
  /** Stats endpoint: dismissed contradictions */
  dismissed?: number;
  /** Stats endpoint: breakdown by category */
  by_category?: Record<string, { total: number; open: number; resolved: number; dismissed: number }>;
  /** Scan endpoint: total claim pairs compared */
  total_compared?: number;
  /** Scan endpoint: number of conflicts found */
  conflicts?: number;
  /** Scan endpoint: number of matches found */
  matches?: number;
  /** Scan endpoint: number of uncertain comparisons */
  uncertain?: number;
  /** Scan endpoint: detailed contradiction records */
  records?: Record<string, unknown>[];
}

export interface IntelContradictMeta {
  conflict_id: string;
  status: string;
  updated_at: number;
}

export interface IntelContradictDetailResponse {
  conflict_id: string;
  session_id: string;
  category: string;
  subject: string;
  attribute: string;
  value_a: string;
  value_b: string;
  doc_a: string;
  doc_b: string;
  fact_a_id: string;
  fact_b_id: string;
  matching: boolean;
  conflict: boolean;
  explanation: string;
  status: string;
  evidence_a: string;
  evidence_b: string;
}

/* ---- Knowledge graph / stats types ---- */

export interface IntelStatsResponse {
  documents: number;
  chunks: number;
  entities: number;
  facts: number;
  relationships: number;
  topics?: number;
  storage_bytes?: number;
  sources_with_size?: number;
}

export interface DocumentGraphEdge {
  shared_entities?: Array<{ entity_id: string; name: string }>;
  source: string;
  target: string;
  weight: number;
  similarity: number;
  rel_type: string;
  evidence: string;
}

export interface IntelDocumentGraphResponse {
  documents: IntelDocument[];
  edges: DocumentGraphEdge[];
}

export interface EntityFact {
  fact_id: string;
  doc_id: string;
  filename: string;
  subject: string;
  attribute: string;
  value: string;
  value_type: string;
  unit: string | null;
  period: string | null;
  evidence: string;
  status: string;
}

export interface EntityRelated {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  aliases: string[];
  status: string;
}

export interface IntelEntityDetailResponse {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  aliases: string[];
  status: string;
  fact_count: number;
  facts: EntityFact[];
  related_entities: EntityRelated[];
  related_count: number;
}

export interface DependencyNode {
  id: string;
  label: string;
  type: string;
  factCount: number;
  status: string;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  relType: string;
  evidence: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

