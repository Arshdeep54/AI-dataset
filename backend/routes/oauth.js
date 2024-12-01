const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');

const CLIENT_ID = process.env.CHANNELI_CLIENT_ID;
const CLIENT_SECRET = process.env.CHANNELI_CLIENT_SECRET;
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? 'http://localhost/oauth/callback'
  : 'http://localhost:5000/oauth/callback';

router.get('/channeli', (req, res) => {
    const channeli_url = `https://channeli.in/oauth/authorise/?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=random_state_string`;
    res.redirect(channeli_url);
});

router.get('/callback', async (req, res) => {
    const { code, state } = req.query;

    try {
        // Exchange authorization code for access token
        const tokenResponse = await axios.post('https://channeli.in/oauth/token/', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code: code
        });

        const accessToken = tokenResponse.data.access_token;

        // Get user information using the access token
        const userResponse = await axios.get('https://channeli.in/open_auth/get_user_data/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const userData = userResponse.data;
        
        // Create JWT token
        const token = jwt.sign(
            { userId: userData.userId, username: userData.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Redirect to frontend with token
        res.redirect(`/?token=${token}`);

    } catch (error) {
        console.error('OAuth Error:', error.response?.data || error.message);
        res.redirect('/?error=authentication_failed');
    }
});

router.get('/test', (req, res) => {
    res.json({ 
        message: 'OAuth routes are working',
        clientId: CLIENT_ID ? 'Configured' : 'Missing',
        clientSecret: CLIENT_SECRET ? 'Configured' : 'Missing',
        redirectUri: REDIRECT_URI
    });
});

module.exports = router;
