require('dotenv').config();
const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Proxy
app.set('trust proxy', 1);

// JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log
app.use(morgan('combined'));

app.use(cookieParser());

app.use(session({
	secret: process.env.SESSION_SECRET || 'supersecret',
	resave: false,
	saveUninitialized: true,
	cookie: { 
		secure: true,      
		httpOnly: true, 
		sameSite: "None",  
		maxAge: 86400000   
	}
}));

app.post('/login', async (req, res) => {
	const { username, password } = req.body;
	const users = readUsersFromFile();
	const user = users.find(u => u.username === username);

	if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}

	req.session.user = username;
	req.session.save(err => {
		if (err) {
			return res.status(500).json({ error: 'Session save error' });
		}
		res.cookie('sessionID', req.sessionID, { 
			httpOnly: true, 
			secure: true, 
			sameSite: "None", 
			maxAge: 86400000 
		});
		res.json({ message: 'Login successful', username });
	});
});

app.get('/chat-completion', async (req, res) => {
	if (!req.session.user) {
		return res.status(403).json({ error: 'Unauthorized' });
	}

	const { request } = req.query;
	if (!request) {
		return res.status(400).json({ error: 'Missing request parameter' });
	}

	try {
		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-4o-mini',
				messages: [{ role: 'user', content: request }],
				max_tokens: 400
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

app.post('/chat-completion', async (req, res) => {
	if (!req.session.user) {
		return res.status(403).json({ error: 'Unauthorized' });
	}

	const { messages, secret } = req.body;

	if (secret !== process.env.API_SECRET) {
		return res.status(401).json({ error: 'Invalid secret' });
	}

	if (!messages || !Array.isArray(messages)) {
		return res.status(400).json({ error: 'Invalid messages format' });
	}

	try {
		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-4o-mini', 
				messages: messages, 
				max_tokens: 400,
			},
			{
				headers: {
					Authorization: `Bearer ${OPENAI_API_KEY}`,
					'Content-Type': 'application/json',
				},
			}
		);

		res.json(response.data);
	} catch (error) {
		console.error('OpenAI API error:', error.response ? error.response.data : error.message);
		res.status(500).json({ error: 'Failed to fetch response from OpenAI' });
	}
});


app.post('/generate-image', async (req, res) => {
	if (!req.session.user) {
		return res.status(403).json({ error: 'Unauthorized' });
	}

	const { prompt } = req.body;
	if (!prompt) {
		return res.status(400).json({ error: 'Missing prompt' });
	}

	try {
		const response = await axios.post(
			'https://api.openai.com/v1/images/generations',
			{
				model: "dall-e-2",
				prompt: prompt,
				n: 1,
				size: "512x512"
			},
			{
				headers: {
					'Authorization': `Bearer ${OPENAI_API_KEY}`,
					'Content-Type': 'application/json'
				}
			}
		);

		res.json({ image_url: response.data.data[0].url });
	} catch (error) {
		console.error("Error with DALLE:", error.response ? error.response.data : error.message);
		res.status(500).json({ error: 'Failed to generate image' });
	}
});

app.post('/logout', (req, res) => {
	req.session.destroy(() => {
		res.clearCookie('sessionID');
		res.json({ message: 'Logged out' });
	});
});

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

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

