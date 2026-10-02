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
    assert.match(await home.text(), /Found Along/);
    assert.equal(home.headers.get('set-cookie'), null);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');

    const singapore = await fetch(`${base}/singapore`);
    assert.equal(singapore.status,200);
    assert.match(singapore.headers.get('cache-control') ?? '',/no-store/);
    const singaporeHtml = await singapore.text();
    assert.match(singaporeHtml, /<h1>Singapore<\/h1>/);
    assert.match(singaporeHtml, /Home\./);
    assert.doesNotMatch(singaporeHtml,/internal_notes|storage_key|file_hash|source\.jpg/);
    const admin = await fetch(`${base}/admin`, { redirect: 'manual' });
    assert.equal(admin.status, 307);
    const destination = admin.headers.get('location');
    assert.ok(destination === '/admin/login?issue=unauthenticated' || destination === '/admin/login?issue=config');
    const configured = destination === '/admin/login?issue=unauthenticated';
    assert.match(admin.headers.get('cache-control') ?? '', /no-store/);
    for (const path of ['/admin/hotels', '/admin/hotels/new', '/admin/hotels/50000000-0000-4000-8000-000000000001', '/admin/stays', '/admin/stays/new', '/admin/stays/60000000-0000-4000-8000-000000000001', '/admin/trips', '/admin/trips/new', '/admin/trips/30000000-0000-4000-8000-000000000001', '/admin/locations', '/admin/locations/new', '/admin/locations/40000000-0000-4000-8000-000000000001', '/admin/photos', '/admin/photos/import', '/admin/photos/70000000-0000-4000-8000-000000000001']) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.equal(response.status, 307, path);
      assert.equal(response.headers.get('location'), destination, path);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/, path);
    }
    for (const operation of ['batch','prepare','process','cleanup','finish','cancel']) {
      const response = await fetch(`${base}/admin/photos/api/${operation}`, { method: 'POST', headers: { origin: base, 'Content-Type': 'application/json' }, body: '{}', redirect: 'manual' });
      assert.equal(response.status, configured ? 401 : 503, operation);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      assert.doesNotMatch(await response.text(), /X-Amz-|SecretAccessKey|cloudflarestorage/);
    }
    for (const path of ['/admin/photos/storage','/admin/photos/70000000-0000-4000-8000-000000000001/image/source','/admin/photos/70000000-0000-4000-8000-000000000001/image/thumbnail']) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.equal(response.status, configured ? 401 : 503, path);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
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
    assert.equal((await fetch(`${base}/trips/not_valid`)).status, 404);
    assert.equal((await fetch(`${base}/locations/not_valid`)).status, 404);
    assert.equal((await fetch(`${base}/stays/not_valid`)).status,404);
    const stays=await fetch(`${base}/stays`);assert.equal(stays.status,200);assert.match(stays.headers.get('cache-control')??'',/no-store/);assert.equal(stays.headers.get('set-cookie'),null);
    const staysHtml=await stays.text();assert.match(staysHtml,/<h1>Stays<\/h1>/);assert.doesNotMatch(staysHtml,/internal_notes|storage_key|file_hash|source\.jpg/);
    if(configured) for(const path of ['/stays/missing-hotel-for-smoke-7af9','/stays/missing-hotel-for-smoke-7af9/60000000-0000-4000-8000-000000000001'])assert.equal((await fetch(`${base}${path}`)).status,404);
    const hotelLink=staysHtml.match(/href="(\/stays\/[a-z0-9-]+)"/);
    if(hotelLink){const response=await fetch(`${base}${hotelLink[1]}`);assert.equal(response.status,200);const body=await response.text();assert.doesNotMatch(body,/internal_notes|storage_key|source\.jpg/);const stayLink=body.match(/href="(\/stays\/[a-z0-9-]+\/[a-f0-9-]{36})"/);if(stayLink){const response=await fetch(`${base}${stayLink[1]}`);assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/internal_notes|storage_key|source\.jpg/);}}
    const trips = await fetch(`${base}/trips`);
    assert.equal(trips.status, 200);
    assert.match(trips.headers.get('cache-control') ?? '', /no-store/);
    assert.equal(trips.headers.get('set-cookie'), null);
    const tripHtml = await trips.text();
    assert.match(tripHtml, /<h1>Trips<\/h1>/);
    assert.doesNotMatch(tripHtml, /internal_notes|storage_key|file_hash|source\.jpg/);
    const tripLink = tripHtml.match(/href="(\/trips\/[a-z0-9-]+)"/);
    if (tripLink) {
      const trip = await fetch(`${base}${tripLink[1]}`);
      assert.equal(trip.status, 200);
      assert.match(trip.headers.get('cache-control') ?? '', /no-store/);
      const html = await trip.text();
      assert.doesNotMatch(html, /internal_notes|storage_key|source\.jpg/);
      const placeLink = html.match(/href="(\/locations\/[a-z0-9-]+)"/);
      if (placeLink) {
        const place = await fetch(`${base}${placeLink[1]}`);
        assert.equal(place.status, 200);
        assert.match(place.headers.get('cache-control') ?? '', /no-store/);
        assert.match(await place.text(), /Trips through this place/);
      }
      for (const path of ['/trips/missing-trip-for-smoke-7af9', '/locations/missing-location-for-smoke-7af9']) assert.equal((await fetch(`${base}${path}`)).status, 404);
    }
    for (const path of ['/photos', '/photos?view=record']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      assert.equal(response.headers.get('set-cookie'), null);
      const html = await response.text();
      assert.match(html, /Photography selection/);
      assert.doesNotMatch(html, /internal_notes|storage_key|file_hash|captured_at_offset_minutes|source\.jpg/);
      const photoLink = html.match(/href="(\/photos\/[0-9a-f-]{36})"/);
      if (photoLink) {
        const detail = await fetch(`${base}${photoLink[1]}`);
        assert.equal(detail.status, 200);
        assert.match(detail.headers.get('cache-control') ?? '', /no-store/);
        assert.doesNotMatch(await detail.text(), /internal_notes|storage_key|file_hash|source\.jpg/);
        const image = await fetch(`${base}${photoLink[1]}/image/thumbnail`, { headers: { cookie: 'sb-test-auth-token=invalid' } });
        assert.equal(image.status, 200);
        assert.equal(image.headers.get('content-type'), 'image/webp');
        assert.match(image.headers.get('cache-control') ?? '', /no-store/);
        const bytes = new Uint8Array(await image.arrayBuffer());
        assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WEBP');
        const missing = await fetch(`${base}/photos/ffffffff-ffff-4fff-8fff-ffffffffffff`);
        assert.equal(missing.status, 404);
        const hiddenImage = await fetch(`${base}/photos/ffffffff-ffff-4fff-8fff-ffffffffffff/image/large`);
        assert.equal(hiddenImage.status, 404);
      }
    }
    assert.equal((await fetch(`${base}/photos/not-a-photo-id`)).status, 404);
    for (const variant of ['source', 'source.jpg', 'unknown']) {
      const response = await fetch(`${base}/photos/70000000-0000-4000-8000-000000000001/image/${variant}`);
      assert.equal(response.status, 404);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    }
    const optimizer = await fetch(`${base}/_next/image?url=%2Fphotos%2F70000000-0000-4000-8000-000000000001%2Fimage%2Flarge&w=640&q=75`);
    assert.equal(optimizer.status, 400, 'Optimizer must not cache protected local images.');
    console.log(`Production smoke passed: ${configured ? 'configured/no-session' : 'missing configuration'}, private redirects, no registration routes.`);
  } finally {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await Promise.race([exited, delay(5000).then(() => { server.kill('SIGKILL'); })]);
  }
}
