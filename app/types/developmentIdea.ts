"use strict";

export type DevelopmentIdeaRow = {
  id: number;
  type: string | null;
  event_timestamp: number | null;
  agent_id: string | null;
  conversation_id: string | null;
  status: string | null;
  user_id: string | null;
  transcript: Record<string, unknown> | null;
  received_at: string | null;
  body: Record<string, unknown> | null;
  transcript_summary: string | null;
  call_duration_secs: number | null;
  main_language: string | null;
  call_summary_title: string | null;
  research_type: string | null;
  development_status: string | null;
  created_by: string | null;
};
