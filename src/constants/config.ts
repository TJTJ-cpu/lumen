const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
};

export const GEMINI_API_KEY = required(
  'EXPO_PUBLIC_GEMINI_API_KEY',
  process.env.EXPO_PUBLIC_GEMINI_API_KEY
);

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
