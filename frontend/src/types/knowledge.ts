export type KnowledgeDocumentStatus = "pending" | "processing" | "indexed" | "failed" | "disabled";

export type KnowledgeSourceType = "article" | "upload" | "custom" | "webpage";

export interface KnowledgeDocument {
  id: number;
  source_type: KnowledgeSourceType;
  source_id?: number;
  source_url?: string;
  title: string;
  content_type: string;
  content_length: number;
  status: KnowledgeDocumentStatus;
  chunk_count: number;
  error_message?: string;
  indexed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  total_documents: number;
  indexed_documents: number;
  pending_documents: number;
  failed_documents: number;
  total_chunks: number;
  total_tokens: number;
}

export interface KnowledgeConfig {
  enabled: boolean;
  embedding_provider: string;
  embedding_model: string;
  vector_store: string;
  vector_dimension: number;
}

export interface RebuildStatus {
  is_rebuilding: boolean;
  start_time: number;
  end_time: number;
  old_provider: string;
  old_model: string;
  new_provider: string;
  new_model: string;
  total_docs: number;
  processed_docs: number;
  failed_docs: number;
  error: string;
}

export interface ListKnowledgeDocumentsRequest {
  status?: string;
  page?: number;
  page_size?: number;
}

export interface ListKnowledgeDocumentsResponse {
  documents: KnowledgeDocument[];
  total: number;
  page: number;
  page_size: number;
}

export interface IndexDocumentRequest {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BatchDeleteResult {
  documents_deleted: number;
  chunks_deleted: number;
  failed_ids?: number[];
}

export interface ClearResult {
  documents_deleted: number;
  chunks_deleted: number;
  vectors_cleared: boolean;
}

export interface SyncArticlesResult {
  total_articles: number;
  new_documents: number;
  updated_documents: number;
  skipped_documents: number;
  failed_documents: number;
}
