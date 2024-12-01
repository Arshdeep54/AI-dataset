const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const cookie = require("cookie-parser");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost','http://localhost:5173'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname + "/public"));

app.use(cookie());

// Session middleware
app.use(
  session({
    secret: process.env.JWT_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// Serve static images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Import routes
const surveyRoutes = require('./routes/surveyRoutes');
const oauthRoutes = require('./routes/oauth2');

// Use routes
app.use('/api', surveyRoutes);
app.use("/oauth", oauthRoutes);

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
