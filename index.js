require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_SECRET = process.env.API_SECRET;

// Log
app.use(morgan('combined'));

// Chat route
app.get('/chat-completion', async (req, res) => {
    const { request, secret } = req.query;

    if (secret !== API_SECRET) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (!request) {
        return res.status(400).json({ error: 'Missing request parameter' });
    }

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: request }],
                max_tokens: 100
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error calling OpenAI API:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch response from OpenAI' });
    }
});

// Rate limit
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
