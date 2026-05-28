
import http from 'http';
import { URL } from 'url';
import { evaluateGasRoute } from './gasroute-oracle.js';

const PORT = process.env.PORT || 18999;
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/api/gasroute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const input = JSON.parse(body);
        const chainSet = input.chain_set || ['ethereum', 'optimism', 'arbitrum', 'base', 'polygon'];
        const calldataSize = Number(input.calldata_size_bytes || 0);
        const gasUnitsEst = Number(input.gas_units_est || 21000);
        
        const recommendation = await evaluateGasRoute(chainSet, calldataSize, gasUnitsEst);
        res.writeHead(200);
        res.end(JSON.stringify(recommendation));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON or input format' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`GasRoute Oracle running on port ${PORT}`);
});
