require('dotenv').config();
const express = require('express');
const cors = require('cors');

const newsRoutes = require('./routes/news');
const marketsRoutes = require('./routes/markets');
const weatherRoutes = require('./routes/weather');
const manualDataRoutes = require('./routes/manualData');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    keysConfigured: {
      newsapi: Boolean(process.env.NEWSAPI_KEY) && !process.env.NEWSAPI_KEY.includes('your_'),
      twelvedata: Boolean(process.env.TWELVEDATA_KEY) && !process.env.TWELVEDATA_KEY.includes('your_'),
      openweather: Boolean(process.env.OPENWEATHER_KEY) && !process.env.OPENWEATHER_KEY.includes('your_'),
    },
  });
});

app.use('/api/news', newsRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/prices', manualDataRoutes);

// Serve the frontend build (see public/index.html)
app.use(express.static('public'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`BRIEF backend listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
