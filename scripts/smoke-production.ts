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

// NEXT_PUBLIC variables are frozen into a production build. Test that build's
// actual configuration; config validation is separately covered by unit tests.
{
  const port = await unusedPort();
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env },
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
    const destination = admin.headers.get('location');
    assert.ok(destination === '/admin/login?issue=unauthenticated' || destination === '/admin/login?issue=config');
    const configured = destination === '/admin/login?issue=unauthenticated';
    assert.match(admin.headers.get('cache-control') ?? '', /no-store/);
    for (const path of ['/admin/trips', '/admin/trips/new', '/admin/trips/30000000-0000-4000-8000-000000000001', '/admin/locations', '/admin/locations/new', '/admin/locations/40000000-0000-4000-8000-000000000001']) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.equal(response.status, 307, path);
      assert.equal(response.headers.get('location'), destination, path);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/, path);
    }

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
    assert.equal((await fetch(`${base}/trips/example`)).status, 404);
    console.log(`Production smoke passed: ${configured ? 'configured/no-session' : 'missing configuration'}, private redirects, no registration routes.`);
  } finally {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await Promise.race([exited, delay(5000).then(() => { server.kill('SIGKILL'); })]);
  }
}
