// A small injectable boundary for tests; production supplies a typed Supabase session client.
export type AdminAuthClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc: (name: 'is_admin') => PromiseLike<{ data: boolean | null; error: unknown }>;
};

export type AdminCheck =
  | { status: 'admin'; userId: string }
  | { status: 'unauthenticated' | 'forbidden' | 'unavailable' };

export async function checkAdmin(client: AdminAuthClient): Promise<AdminCheck> {
  try {
    // getUser validates the session with Supabase Auth; never trust getSession/cookie contents alone.
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { status: 'unauthenticated' };
    const result = await client.rpc('is_admin');
    if (result.error) return { status: 'unavailable' };
    if (result.data !== true) return { status: 'forbidden' };
    return { status: 'admin', userId: data.user.id };
  } catch {
    return { status: 'unavailable' };
  }
}
