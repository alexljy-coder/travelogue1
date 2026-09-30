import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

async function unusedPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

for (const configured of [false, true]) {
  const port = await unusedPort();
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: configured ? 'http://127.0.0.1:54321' : '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured ? 'sb_publishable_synthetic_smoke_only' : '',
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('Production server exited before becoming ready.');
      try {
        if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).status === 200) { ready = true; break; }
      } catch { /* Server is still starting. */ }
      await delay(200);
    }
    assert.ok(ready, 'Production server must start.');
    const home = await fetch(base);
    assert.match(await home.text(), /Travel archive/);
    assert.equal(home.headers.get('set-cookie'), null);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');

    const admin = await fetch(`${base}/admin`, { redirect: 'manual' });
    assert.equal(admin.status, 307);
    assert.equal(admin.headers.get('location'), `/admin/login?issue=${configured ? 'unauthenticated' : 'config'}`);
    assert.match(admin.headers.get('cache-control') ?? '', /no-store/);

    const login = await fetch(`${base}/admin/login`);
    assert.equal(login.status, 200);
    assert.match(login.headers.get('cache-control') ?? '', /no-store/);
    const html = await login.text();
    if (configured) assert.match(html, /name="password"/);
    else {
      assert.match(html, /Supabase is not configured/);
      assert.doesNotMatch(html, /name="password"/);
    }
    assert.equal((await fetch(`${base}/signup`)).status, 404);
    assert.equal((await fetch(`${base}/admin/register`)).status, 404);
    console.log(`Production smoke passed: ${configured ? 'configured/no-session' : 'missing configuration'}, private redirects, no registration routes.`);
  } finally {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await Promise.race([exited, delay(5000).then(() => { server.kill('SIGKILL'); })]);
  }
}
