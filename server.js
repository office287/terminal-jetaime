const express = require('express');
const morgan = require('morgan');
const geoip = require('geoip-lite');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

morgan.token('geo', (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const geo = geoip.lookup(ip);
  if (!geo) return `${ip} [unknown]`;
  const parts = [geo.country];
  if (geo.region) parts.push(geo.region);
  if (geo.city) parts.push(geo.city);
  return `${ip} [${parts.join(', ')}]`;
});

app.use(morgan(':geo - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => console.log(`terminal je t'aime running on port ${PORT}`));
