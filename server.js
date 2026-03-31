const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

const ADMIN_KEY = 'Kep1';
const PORT = process.env.PORT || 3000;
const LUA_SCRIPT = fs.readFileSync('script.lua', 'utf8');

let blacklist = new Set();

app.get('/', (req, res) => {
  const hwid = req.query.hwid;

  if (!hwid) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  const fakeHwids = ['TEST', 'UNKNOWN', 'test', 'unknown'];
  if (fakeHwids.includes(hwid) || hwid.length < 20) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  if (blacklist.has(hwid)) {
    return res.send('error("❌ You are banned.")');
  }

  console.log(`[SCRIPT] Delivered to HWID: ${hwid}`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(LUA_SCRIPT);
});

app.post('/admin/ban', (req, res) => {
  const { key, hwid } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  if (!hwid) return res.status(400).json({ error: 'No HWID provided' });
  blacklist.add(hwid);
  console.log(`[ADMIN] Banned: ${hwid}`);
  res.json({ success: true, banned: hwid });
});

app.post('/admin/unban', (req, res) => {
  const { key, hwid } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  blacklist.delete(hwid);
  console.log(`[ADMIN] Unbanned: ${hwid}`);
  res.json({ success: true, unbanned: hwid });
});

app.get('/admin/list', (req, res) => {
  const { key } = req.query;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  res.json({ blacklist: [...blacklist] });
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
