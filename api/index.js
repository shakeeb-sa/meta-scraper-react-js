const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

// Allow requests from anywhere (or configure specific domains in production)
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Helper Function
const scrapeUrl = async (url) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 
    });

    const $ = cheerio.load(data);
    const title = ($('title').contents().first().text() || $('title').text()).trim() || 'No Title Found';
    const description = $('meta[name="description"]').attr('content')?.trim() || 'No Description Found';

    return {
      status: 'success',
      url,
      result: `${title}; ${description}`
    };

  } catch (error) {
    return {
      status: 'error',
      url,
      reason: `Failed to scrape. (${error.message})`
    };
  }
};

// Main Endpoint
app.post('/api/scrape', async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ message: 'Please provide an array of URLs.' });
  }

  const uniqueUrls = [...new Set(urls.filter(url => url.trim() !== ''))];

  try {
    const scrapePromises = uniqueUrls.map(url => scrapeUrl(url));
    const settledResults = await Promise.allSettled(scrapePromises);
    
    const responseData = settledResults.map(result => {
        if (result.status === 'fulfilled') return result.value;
        return { status: 'error', reason: 'Unexpected error.' };
    });

    res.json({ data: responseData });

  } catch (error) {
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// For Vercel, we export the app. 
// Vercel handles the server listening automatically.
module.exports = app;