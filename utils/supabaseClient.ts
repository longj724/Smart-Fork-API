// External Dependencies
import { createClient } from '@supabase/supabase-js';

// Relative Dependencies
import { Database } from '../types/supabase';

export const supabaseClient = async (supabaseToken: string) => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_PUBLIC_KEY as string,
    {
      global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
    }
  );
  return supabase;
};
