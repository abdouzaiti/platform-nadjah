import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Normalize URL (strip trailing slashes or /rest/v1/ suffix if pasted by mistake)
const supabaseUrl = rawUrl?.trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');

if (process.env.NODE_ENV === 'development') {
  console.log('[Supabase Config Check]', {
    urlPresent: !!supabaseUrl,
    keyPresent: !!supabaseAnonKey,
    isValidUrl: !!supabaseUrl && /^https?:\/\//.test(supabaseUrl)
  });
}

const isValidUrl = (url: any): boolean => {
  if (!url || typeof url !== 'string') return false;
  let targetUrl = url;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const supabaseUrlToUse = (url: string | undefined) => {
  if (!url) return 'https://placeholder.supabase.co';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
};

export const supabaseConfigured = isValidUrl(supabaseUrl) && Boolean(supabaseAnonKey);
export const isProperAnonKey = typeof supabaseAnonKey === 'string' && (supabaseAnonKey.startsWith('ey') || supabaseAnonKey.startsWith('sb_'));

// Use a placeholder if not configured to prevent immediate crash during import
export const supabase = createClient(
  supabaseUrlToUse(supabaseUrl), 
  supabaseAnonKey || 'placeholder'
);
