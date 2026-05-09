import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Normalize URL (strip trailing slashes or /rest/v1/ suffix if pasted by mistake)
const supabaseUrl = rawUrl?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const isValidUrl = (url: any): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const supabaseConfigured = isValidUrl(supabaseUrl) && Boolean(supabaseAnonKey);
export const isProperAnonKey = typeof supabaseAnonKey === 'string' && supabaseAnonKey.startsWith('ey');

// Use a placeholder if not configured to prevent immediate crash during import
export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
