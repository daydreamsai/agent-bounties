'use strict';

const http = require('node:http');
const { auditApprovals } = require('./auditor');

const PORT = Number(process.env.PORT || 3000);

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'POST' && req.url === '/audit') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        const input = JSON.parse(raw || '{}');
        const result = auditApprovals(input);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, { error: String((err && err.message) || err) });
      }
    });
    return;
  }
  return sendJson(res, 404, { error: 'not found' });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`approval-risk-auditor listening on :${PORT}`));
}

module.exports = { server };
