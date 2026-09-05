require('dotenv').config();
const express = require('express');
const cors = require('cors');

const newsRoutes = require('./routes/news');
const marketsRoutes = require('./routes/markets');
const weatherRoutes = require('./routes/weather');
const manualDataRoutes = require('./routes/manualData');
const compareRoutes = require('./routes/compare');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    keysConfigured: {
      newsapi: Boolean(process.env.NEWSAPI_KEY) && !process.env.NEWSAPI_KEY.includes('your_'),
      marketData: true,
      database: db.isConfigured(),
      openweather: Boolean(process.env.OPENWEATHER_KEY) && !process.env.OPENWEATHER_KEY.includes('your_'),
    },
  });
});

app.use('/api/news', newsRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/prices', manualDataRoutes);
app.use('/api/compare', compareRoutes);

// Serve the frontend build (see public/index.html)
app.use(express.static('public'));

const PORT = process.env.PORT || 4000;
(async () => {
  try { await db.initDb(); }
  catch (err) { console.error('Database initialization failed:', err.message); }
  app.listen(PORT, () => {
    console.log(`BRIEF backend listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
})();
