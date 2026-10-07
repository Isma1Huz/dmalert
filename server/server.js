const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // empty = no auth (local dev only)

// HTTP server: health check for Render + WebSocket upgrade on the same port
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(200); res.end('Team Alert server');
});
const wss = new WebSocketServer({ server });
const clients = new Map(); // name -> socket

function broadcastPresence() {
  const users = [...clients.keys()];
  for (const ws of clients.values()) ws.send(JSON.stringify({ type: 'presence', users }));
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'hello') {
      if (AUTH_TOKEN && m.token !== AUTH_TOKEN) return ws.close(4001, 'bad token');
      if (!m.name) return ws.close(4002, 'name required');
      ws.name = m.name; clients.set(m.name, ws); broadcastPresence();
    } else if ((m.type === 'alert' || m.type === 'reply') && ws.name) {
      const target = clients.get(m.to);
      if (target) target.send(JSON.stringify({ type: m.type, from: ws.name, text: m.text || '' }));
    }
    // 'ping' messages from clients are ignored; they just keep the connection active
  });
  ws.on('close', () => {
    if (ws.name && clients.get(ws.name) === ws) { clients.delete(ws.name); broadcastPresence(); }
  });
});

// Drop dead connections so the online list stays accurate
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log('Team Alert server on port ' + PORT));
