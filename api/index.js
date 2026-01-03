const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Enable CORS for all requests
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// --- Logic Function ---
const handleScrapeRequest = async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ message: 'Please provide an array of URLs.' });
  }

  const uniqueUrls = [...new Set(urls.filter(url => url.trim() !== ''))];

  const scrapeSingleUrl = async (url) => {
    try {
      // Validate URL format roughly to prevent crash
      if (!url.startsWith('http')) {
        return { status: 'error', url, reason: 'Invalid URL format (must start with http/https)' };
      }

      const { data } = await axios.get(url, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 8000 // 8s timeout
      });
      
      const $ = cheerio.load(data);
      const title = ($('title').contents().first().text() || $('title').text()).trim() || 'No Title Found';
      
      // Try standard description first, then OG description
      let description = $('meta[name="description"]').attr('content')?.trim();
      if (!description) {
          description = $('meta[property="og:description"]').attr('content')?.trim();
      }
      if (!description) {
          description = 'No Description Found';
      }

      // Remove newlines from result to keep CSV/Text format clean
      const cleanTitle = title.replace(/(\r\n|\n|\r)/gm, " ");
      const cleanDesc = description.replace(/(\r\n|\n|\r)/gm, " ");

      return { status: 'success', url, result: `${cleanTitle}; ${cleanDesc}` };
    } catch (error) {
      console.error(`Failed ${url}: ${error.message}`);
      return { status: 'error', url, reason: `Failed to scrape: ${error.message}` };
    }
  };

  try {
    const scrapePromises = uniqueUrls.map(url => scrapeSingleUrl(url));
    const settledResults = await Promise.allSettled(scrapePromises);
    
    const responseData = settledResults.map(result => {
        if (result.status === 'fulfilled') return result.value;
        return { status: 'error', reason: 'Unexpected server error processing this URL.' };
    });

    res.json({ data: responseData });

  } catch (error) {
    console.error("Critical API Error:", error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// --- Routes ---
app.post('/api/scrape', handleScrapeRequest);

// Health Check
app.get('/api/scrape', (req, res) => res.send('API Endpoint Ready (POST).'));
app.get('/', (req, res) => res.send('API Root Ready.'));

// --- Local Development Server ---
// Vercel manages the port automatically, so this only runs locally
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

module.exports = app;