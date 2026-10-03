import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function createTestDatabase(through?: string) {
  const db = new PGlite();
  await db.exec(await readFile(resolve('supabase/tests/bootstrap.sql'), 'utf8'));
  const migrations = (await readdir(resolve('supabase/migrations'))).filter((name) => name.endsWith('.sql') && !name.startsWith('._')).sort();
  for (const name of migrations) {
    if(through && name>through) break;
    await db.exec(await readFile(resolve('supabase/migrations', name), 'utf8'));
  }
  return db;
}

export async function asRole<T>(db: PGlite, role: 'anon' | 'authenticated', userId: string | null, run: () => Promise<T>) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  try { return await run(); } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
