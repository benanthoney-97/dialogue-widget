export type AgentDocumentRow = {
  id: string;
  agent_id: string;
  file_name: string;
  storage_path?: string | null;
  profile_image?: string | null;
  public_url?: string | null;
  document_url?: string | null;
  document_id?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  source?: string | null;
  created_at?: string | null;
  added_stage?: string | null;
};

export type PersonaDocumentRecord = AgentDocumentRow;
