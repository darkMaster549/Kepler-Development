const express = require('express');
const crypto = require('crypto');
const path = require('path');
const app = express();

app.use(express.json());

// ================================================
// CONFIG — change these!
// ================================================
const ADMIN_KEY = 'Kep';
const PORT = process.env.PORT || 3000;

// Your real Lua script
const LUA_SCRIPT = `

print("Loaded!")
`;

// ================================================
// STORAGE
// ================================================
let blacklist = new Set();
let usedTokens = new Map(); // token -> hwid, expires

// ================================================
// HELPERS
// ================================================
function xorEncrypt(str, key) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(out).toString('base64');
}

function generateToken(hwid) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 30000; // 30 seconds
  usedTokens.set(token, { hwid, expires });
  return token;
}

function cleanTokens() {
  const now = Date.now();
  for (const [token, data] of usedTokens) {
    if (data.expires < now) usedTokens.delete(token);
  }
}

// ================================================
// ROUTES
// ================================================

// Serve fake cover page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Step 1 — Check HWID
app.get('/check', (req, res) => {
  const hwid = req.query.hwid;

  if (!hwid) return res.send('DENIED');

  if (blacklist.has(hwid)) {
    console.log(`[BLOCKED] HWID: ${hwid} | IP: ${req.ip}`);
    return res.send('BLOCKED');
  }

  const token = generateToken(hwid);
  console.log(`[OK] HWID: ${hwid} | Token issued`);
  res.send('OK:' + token);
});

// Step 2 — Get script (requires valid one-time token + matching HWID)
app.get('/script', (req, res) => {
  const { hwid, token } = req.query;
  cleanTokens();

  if (!hwid || !token) return res.send('-- DENIED');

  const tokenData = usedTokens.get(token);

  if (!tokenData) return res.send('-- INVALID TOKEN');
  if (tokenData.hwid !== hwid) return res.send('-- HWID MISMATCH');
  if (tokenData.expires < Date.now()) return res.send('-- TOKEN EXPIRED');

  // Token is one-time use
  usedTokens.delete(token);

  if (blacklist.has(hwid)) return res.send('-- BLOCKED');

  // XOR encrypt with token as key so it's useless without it
  const encrypted = xorEncrypt(LUA_SCRIPT, token);
  console.log(`[SCRIPT] Delivered to HWID: ${hwid}`);
  res.send(encrypted);
});

// Ban a HWID
app.post('/admin/ban', (req, res) => {
  const { key, hwid } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  if (!hwid) return res.status(400).json({ error: 'No HWID provided' });
  blacklist.add(hwid);
  console.log(`[ADMIN] Banned HWID: ${hwid}`);
  res.json({ success: true, banned: hwid });
});

// Unban a HWID
app.post('/admin/unban', (req, res) => {
  const { key, hwid } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  blacklist.delete(hwid);
  console.log(`[ADMIN] Unbanned HWID: ${hwid}`);
  res.json({ success: true, unbanned: hwid });
});

// List all banned HWIDs
app.get('/admin/list', (req, res) => {
  const { key } = req.query;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  res.json({ blacklist: [...blacklist] });
});

// ================================================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
