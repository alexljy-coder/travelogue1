import { z } from 'zod';

const configSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  }),
  publishableKey: z.string().startsWith('sb_publishable_').min(16),
});

// Only these explicitly public variables may reach client code. Never accept a secret/service key.
export function parseSupabaseConfig(url: string | undefined, publishableKey: string | undefined) {
  const result = configSchema.safeParse({ url, publishableKey });
  if (!result.success) throw new Error('Supabase configuration is missing or invalid. See docs/supabase-setup.md.');
  return result.data;
}

export function getSupabaseConfig() {
  return parseSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
