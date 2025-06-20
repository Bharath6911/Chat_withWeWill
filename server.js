const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();

// Configure CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from the current directory

// The API key is stored in an environment variable
const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

// Create a proxy endpoint for chat completions
app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': req.headers.origin || 'http://localhost:3000',
        'X-Title': 'DeepSeek Chat App'
      },
      body: JSON.stringify(req.body)
    });
    
    // For streaming responses
    if (req.body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/Wewill.html in your browser`);
});
