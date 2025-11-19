// Utility for inserting contact request into Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ContactRequestPayload = {
  agent_id: string;
  name: string;
  user_email: string;
  phone: string;
  conversation_id?: string;
};

export async function insertContactRequest({ agent_id, name, user_email, phone, conversation_id }: ContactRequestPayload) {
  const row: ContactRequestPayload = {
    agent_id,
    name,
    user_email,
    phone,
  };
  if (conversation_id) {
    row.conversation_id = conversation_id;
  }
  return supabase.from('contact_requests').insert([row]);
}
