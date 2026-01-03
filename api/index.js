const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// --- Logic Function ---
const handleScrapeRequest = async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ message: 'Please provide an array of URLs.' });
  }

  const uniqueUrls = [...new Set(urls.filter(url => url.trim() !== ''))];

  // Helper inside the handler to ensure scope
  const scrapeSingleUrl = async (url) => {
    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' },
        timeout: 5000 // 5s timeout to avoid Vercel limit
      });
      
      const $ = cheerio.load(data);
      const title = ($('title').contents().first().text() || $('title').text()).trim() || 'No Title Found';
      const description = $('meta[name="description"]').attr('content')?.trim() || 'No Description Found';

      return { status: 'success', url, result: `${title}; ${description}` };
    } catch (error) {
      console.error(`Failed ${url}: ${error.message}`);
      return { status: 'error', url, reason: `Failed to scrape. (${error.message})` };
    }
  };

  try {
    const scrapePromises = uniqueUrls.map(url => scrapeSingleUrl(url));
    const settledResults = await Promise.allSettled(scrapePromises);
    
    const responseData = settledResults.map(result => {
        if (result.status === 'fulfilled') return result.value;
        return { status: 'error', reason: 'Unexpected error.' };
    });

    res.json({ data: responseData });

  } catch (error) {
    console.error("Critical API Error:", error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// --- Routing Fix ---
// Vercel might pass the path as '/api/scrape', '/scrape', or even '/'
// We listen to ALL of them to ensure the request is caught.
app.post('/api/scrape', handleScrapeRequest);
app.post('/scrape', handleScrapeRequest);
app.post('/', handleScrapeRequest);

// Health Check (for browser testing)
app.get('/api/scrape', (req, res) => res.send('API is working. Send POST request.'));
app.get('/', (req, res) => res.send('API Root is working.'));

module.exports = app;