// Replace the '/' route with this:
app.get('/', (req, res) => {
  const hwid = req.query.hwid;
  
  if (!hwid) {
    // Browser visit — show fake page
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  if (blacklist.has(hwid)) {
    return res.send('error("❌ You are banned.")');
  }

  const token = generateToken(hwid);
  console.log(`[OK] HWID: ${hwid} | Token: ${token}`);

  // Return Lua code that fetches the real script
  res.setHeader('Content-Type', 'text/plain');
  res.send(`
local token = "${token}"
local hwid = "${hwid}"
local script = game:HttpGet("https://kepler-development.onrender.com/script?hwid="..hwid.."&token="..token)
loadstring(script)()
  `);
});
