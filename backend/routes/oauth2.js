const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2");
const express = require("express");
const router = express.Router();
const XMLHttpRequest = require("xhr2");
const Http = new XMLHttpRequest();
require("dotenv").config();

router.get("/channeli", passport.authenticate("oauth2"));

router.get(
  "/callback",
  passport.authenticate("oauth2", { failureRedirect: "/", session: false }),
  function (req, res) {
    // Store user data in session
    if (!req.session) {
      req.session = {};
    }
    
    // Get user data from the OAuth response
    const userData = req.user ? JSON.parse(req.user) : null;
    if (userData) {
      req.session.userinfo = {
        email: userData.contactInformation.instituteWebmailAddress,
        name: userData.person.fullName,
        enrollmentNumber: userData.student.enrolmentNumber
      };
      
      // Create JWT token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { 
          email: userData.contactInformation.instituteWebmailAddress,
          name: userData.person.fullName,
          enrollmentNumber: userData.student.enrolmentNumber
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Redirect to frontend auth callback with token
      res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
    } else {
      res.redirect('http://localhost:5173/login?error=auth_failed');
    }
  }
);

passport.use(
  new OAuth2Strategy(
    {
      authorizationURL: "https://channeli.in/oauth/authorise",
      tokenURL: "https://channeli.in/open_auth/token/",
      clientID: process.env.CHANNELI_CLIENT_ID,
      clientSecret: process.env.CHANNELI_CLIENT_SECRET,
      callbackURL: "http://localhost:5000/oauth/callback",
    },
    (accessToken, refreshToken, profile, cb) => {
      console.log("OAuth attempted with token:", accessToken);
      const url = `https://channeli.in/open_auth/get_user_data/`;
      Http.open("GET", url);
      Http.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      Http.send();
      Http.onreadystatechange = function () {
        if (Http.readyState === XMLHttpRequest.DONE && Http.status === 200) {
          const data = JSON.parse(Http.responseText);
          console.log("User data received:", data);
          return cb(null, Http.responseText);
        } else if (Http.readyState === XMLHttpRequest.DONE) {
          console.error("Failed to get user data:", Http.status, Http.responseText);
          return cb(new Error('Failed to get user data'));
        }
      };
    }
  )
);

module.exports = router;
