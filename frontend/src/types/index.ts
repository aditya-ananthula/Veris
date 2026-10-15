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
