const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// ================================================
// CONFIG
// ================================================
const ADMIN_KEY = 'kep1.0'; // change this!
const PORT = process.env.PORT || 3000;
const LUA_SCRIPT = fs.readFileSync('script.lua', 'utf8'); // your script

// ================================================
// STORAGE
// ================================================
let blacklist = new Set();
let usedTokens = new Map(); // token -> { hwid, expires }

// ================================================
// HELPERS
// ================================================
function generateToken(hwid) {
  const token = crypto.randomBytes(32).toString('hex');
  usedTokens.set(token, { hwid, expires: Date.now() + 30000 });
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

// '/' — fake page for browsers, loader logic for executors
app.get('/', (req, res) => {
  const hwid = req.query.hwid;

  if (!hwid) {
    // Browser visit — show fake black page
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  if (blacklist.has(hwid)) {
    return res.send('error("You are banned.")');
  }

  const token = generateToken(hwid);
  console.log(`[OK] HWID: ${hwid} | Token issued`);

  res.setHeader('Content-Type', 'text/plain');
  res.send(`
local token = "${token}"
local hwid = "${hwid}"
local result = game:HttpGet("https://kepler-development.onrender.com/script?hwid="..hwid.."&token="..token)
loadstring(result)()
  `);
});

// '/script' — returns real Lua script if token valid
app.get('/script', (req, res) => {
  const { hwid, token } = req.query;
  cleanTokens();

  if (!hwid || !token) return res.send('-- DENIED');

  const tokenData = usedTokens.get(token);
  if (!tokenData) return res.send('-- INVALID TOKEN');
  if (tokenData.hwid !== hwid) return res.send('-- HWID MISMATCH');
  if (tokenData.expires < Date.now()) return res.send('-- TOKEN EXPIRED');

  usedTokens.delete(token); // one-time use
  if (blacklist.has(hwid)) return res.send('-- BLOCKED');

  console.log(`[SCRIPT] Delivered to HWID: ${hwid}`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(LUA_SCRIPT);
});

app.post('/admin/ban', (req, res) => {
  const { key, hwid } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  blacklist.add(hwid);
  console.log(`[ADMIN] Banned: ${hwid}`);
  res.json({ success: true, banned: hwid });
});

app.post('/admin/unban', (req, res) => {
  const { key, hwid } = req.body;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  blacklist.delete(hwid);
  res.json({ success: true, unbanned: hwid });
});

app.get('/admin/list', (req, res) => {
  const { key } = req.query;
  if (key !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  res.json({ blacklist: [...blacklist] });
});

// ================================================
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
