import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAdmin, type AdminAuthClient } from '../src/lib/auth/check-admin';
import { loginSchema } from '../src/lib/validation/login';
import { parseSupabaseConfig } from '../src/lib/supabase/env';

function client(user: { id: string } | null, admin: boolean | null, authError: unknown = null, rpcError: unknown = null): AdminAuthClient {
  return {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    rpc: async () => ({ data: admin, error: rpcError }),
  };
}

test('auth requires a validated user and exact administrator authorization', async () => {
  assert.deepEqual(await checkAdmin(client({ id: 'owner' }, true)), { status: 'admin', userId: 'owner' });
  assert.deepEqual(await checkAdmin(client({ id: 'other' }, false)), { status: 'forbidden' });
  assert.deepEqual(await checkAdmin(client({ id: 'other' }, null)), { status: 'forbidden' });
  assert.deepEqual(await checkAdmin(client(null, true)), { status: 'unauthenticated' });
  assert.deepEqual(await checkAdmin(client({ id: 'owner' }, true, new Error('expired'))), { status: 'unauthenticated' });
  assert.deepEqual(await checkAdmin(client({ id: 'owner' }, true, null, new Error('database offline'))), { status: 'unavailable' });
});

test('auth does not authorize after a thrown network error or trust a cookie-only session', async () => {
  let queried = false;
  const failing: AdminAuthClient = {
    auth: { getUser: async () => { throw new Error('network'); } },
    rpc: async () => { queried = true; return { data: true, error: null }; },
  };
  assert.deepEqual(await checkAdmin(failing), { status: 'unavailable' });
  assert.equal(queried, false);
});

test('login trims email but preserves password bytes, rejects malformed input', () => {
  assert.deepEqual(loginSchema.parse({ email: ' owner@example.com ', password: ' secret ' }), { email: 'owner@example.com', password: ' secret ' });
  for (const input of [{ email: 'bad', password: 'x' }, { email: 'owner@example.com', password: '' }, { email: null, password: null }]) assert.equal(loginSchema.safeParse(input).success, false);
});

test('configuration fails closed on missing values, insecure remote URLs and secret keys', () => {
  assert.throws(() => parseSupabaseConfig(undefined, undefined));
  assert.throws(() => parseSupabaseConfig('https://example.supabase.co', 'sb_secret_never_public'));
  assert.throws(() => parseSupabaseConfig('http://example.com', 'sb_publishable_test_only'));
  assert.equal(parseSupabaseConfig('https://example.supabase.co', 'sb_publishable_test_only').url, 'https://example.supabase.co');
  assert.equal(parseSupabaseConfig('http://127.0.0.1:54321', 'sb_publishable_test_only').url, 'http://127.0.0.1:54321');
});
