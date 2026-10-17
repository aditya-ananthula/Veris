export interface AskResult {
  answer: string;
  sources: string[];
  validation: string;
}

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
  groq_configured: boolean;
  session_ttl_seconds: number;
  persistence: string;
  features: string[];
}

export interface Health {
  status: string;
  app: string;
  groq_configured: boolean;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  validation?: string;
  error?: boolean;
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
}

export interface DocumentGraphEdge {
  source: string;
  target: string;
  weight: number;
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

/* ---- Chart / dashboard types ---- */

export interface StatCard {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  iconColor?: string;
}

export interface DonutSeries {
  label: string;
  value: number;
  color: string;
}

export interface BarSeries {
  label: string;
  value: number;
  color?: string;
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

/* ---- Ranked Document Graph types ---- */

export interface DocumentNode {
  id: string;
  label: string;
  filename: string;
  chunks: number;
  rank: number;
  status: 'indexed' | 'extracting' | 'complete' | 'failed' | 'pending';
  size: number;       // rendered node radius
  x: number;
  y: number;
}

export interface DocumentEdge {
  id: string;
  source: string;
  target: string;
  relType: string;
  evidence: string;
  verified: boolean;
}

export interface DocumentGraph {
  nodes: DocumentNode[];
  edges: DocumentEdge[];
}

export interface DocumentRankEntry {
  rank: number;
  filename: string;
  chunks: number;
  status: string;
  docId: string;
}

/* ---- Chunk Cloud types ---- */

export interface ChunkPoint {
  id: string;
  chunkId: string;
  docId: string;
  docFilename: string;
  chunkIndex: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface ChunkCloudData {
  points: ChunkPoint[];
  documents: { id: string; filename: string; color: string; chunkCount: number }[];
  totalChunks: number;
  projectionMethod: string;
}

/* ---- UI interaction types ---- */

export interface ExpandableCardProps {
  children: React.ReactNode;
  header: React.ReactNode;
  className?: string;
  expanded?: boolean;
  onToggle?: () => void;
}

