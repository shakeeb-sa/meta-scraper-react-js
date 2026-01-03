const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https'); // Import HTTPS to handle SSL errors

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Create an Axios instance that ignores SSL certificate errors (common scraping issue)
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

const handleScrapeRequest = async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of URLs.' });
    }

    const uniqueUrls = [...new Set(urls.filter(url => url && url.trim() !== ''))];

    const scrapeSingleUrl = async (url) => {
      let targetUrl = url.trim();
      
      // Auto-add protocol if missing
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      try {
        const { data } = await axiosInstance.get(targetUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000 // 10 seconds
        });
        
        const $ = cheerio.load(data);
        const title = ($('title').text() || '').trim() || 'No Title Found';
        let description = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || 
                          'No Description Found';

        // Clean up newlines for Excel compatibility
        const cleanTitle = title.replace(/(\r\n|\n|\r)/gm, " ");
        const cleanDesc = description.trim().replace(/(\r\n|\n|\r)/gm, " ");

        return { status: 'success', url: targetUrl, result: `${cleanTitle}; ${cleanDesc}` };
      } catch (error) {
        console.log(`Error scraping ${targetUrl}:`, error.message);
        return { status: 'error', url: targetUrl, reason: error.message };
      }
    };

    const scrapePromises = uniqueUrls.map(url => scrapeSingleUrl(url));
    const results = await Promise.all(scrapePromises); // Use Promise.all to get values directly

    res.json({ data: results });

  } catch (error) {
    console.error("CRITICAL SERVER ERROR:", error);
    // Send the actual error message to the frontend for debugging
    res.status(500).json({ message: `Server Error: ${error.message}` });
  }
};

// Routes
app.post('/api/scrape', handleScrapeRequest);
// For Vercel/Local compatibility
app.post('/scrape', handleScrapeRequest); 

// Health Check
app.get('/', (req, res) => res.send('API is running.'));

// Local Server Start
if (process.env.NODE_ENV !== 'production') {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`\n🚀 Backend Server running at http://localhost:${PORT}`);
        console.log(`   - Waiting for requests...`);
    });
}

module.exports = app;