// Utility for inserting summary request into Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function insertSummaryRequest({ agent_id, user_email, conversation_id }: { agent_id: string, user_email: string, conversation_id: string }) {
  return supabase.from('summary_requests').insert([
    {
      agent_id,
      user_email,
      conversation_id,
      // timestamp will default to now()
    }
  ]);
}
