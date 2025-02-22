require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_SECRET = process.env.API_SECRET;

const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const fs = require('fs');

// Proxy
app.set('trust proxy', 1);

// JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log
app.use(morgan('combined'));

// Chat route
app.get('/chat-completion', async (req, res) => {
	if (!req.session.user) {
		return res.status(403).json({ error: 'Unauthorized' });
	}

	const { request } = req.query;
	if (!request) return res.status(400).json({ error: 'Missing request parameter' });

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
		res.status(500).json({ error: 'Failed to fetch response from OpenAI' });
	}
});

// Rate limit
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Session
app.use(cookieParser());
app.use(session({
	secret: process.env.SESSION_SECRET || 'supersecret', 
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false, httpOnly: true, maxAge: 86400000 } // 1 day
}));

// Users DB *DEV
function readUsersFromFile() {
    if (!fs.existsSync('users.txt')) return [];
    return fs.readFileSync('users.txt', 'utf-8')
        .split('\n')
        .filter(line => line)
        .map(line => {
            const [username, passwordHash] = line.split(',');
            return { username, passwordHash };
        });
}

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsersFromFile();
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = username;
    res.cookie('sessionID', req.sessionID, { httpOnly: true, maxAge: 86400000 });
    res.json({ message: 'Login successful', username });
});

// Remove session route
app.post('/logout', (req, res) => {
	req.session.destroy(); 
	res.clearCookie('sessionID'); 
	res.json({ message: 'Logged out' });
});

// Server
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
