/**
 * Windows workaround: workerd often accepts only loopback even with --ip 0.0.0.0.
 * This Node proxy listens on all interfaces and streams to local wrangler.
 *
 *   wrangler → http://127.0.0.1:8787
 *   phone    → http://<lan-ip>:8788
 *
 * Important: flush each upstream chunk immediately (no pipe coalescing) so
 * chat SSE arrives on-device as small deltas instead of one big dump.
 */
import http from 'node:http';

const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 8787;
const LISTEN_PORT = Number(process.env.FINORA_LAN_PROXY_PORT ?? 8788);

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  // Avoid misleading length on streamed SSE bodies for Expo fetch.
  'content-length',
]);

function sanitizeHeaders(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  // Expo AI SDK guide: prevent transparent decoding issues on device.
  out['content-encoding'] = 'none';
  out['cache-control'] = 'no-cache, no-transform';
  out['x-accel-buffering'] = 'no';
  return out;
}

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` };
  delete headers['connection'];
  delete headers['content-length'];
  delete headers['transfer-encoding'];

  req.socket?.setNoDelay?.(true);

  const upstream = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (up) => {
      up.socket?.setNoDelay?.(true);
      res.writeHead(up.statusCode ?? 502, sanitizeHeaders(up.headers));

      up.on('data', (chunk) => {
        const ok = res.write(chunk);
        if (!ok) up.pause();
      });
      res.on('drain', () => up.resume());
      up.on('end', () => res.end());
      up.on('error', (err) => {
        console.error('[lan-proxy] upstream body error', err.message);
        res.end();
      });
    },
  );

  upstream.on('error', (err) => {
    console.error('[lan-proxy] upstream error', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
    }
    res.end(`Bad gateway: ${err.message}`);
  });

  req.on('aborted', () => {
    upstream.destroy();
  });
  res.on('close', () => {
    if (!res.writableEnded) upstream.destroy();
  });

  req.pipe(upstream);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(
    `[lan-proxy] http://0.0.0.0:${LISTEN_PORT} → http://${TARGET_HOST}:${TARGET_PORT}`,
  );
});
