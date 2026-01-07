const jwt = require('jsonwebtoken');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
require('dotenv').config({ override: true });

module.exports = function(db) {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, (email, password, done) => {
    db.get('SELECT * FROM Users WHERE email = ?', [email], (err, user) => {
      if (err) return done(err);
      if (!user) return done(null, false, { message: 'User not found' });
      if (user.password !== password) return done(null, false, { message: 'Invalid password' });
      return done(null, user);
    });
  }));

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
    const googleConfig = {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    };
    console.log('🔧 Google OAuth config:', { clientID: googleConfig.clientID, callbackURL: googleConfig.callbackURL });
    passport.use(new GoogleStrategy(googleConfig, (accessToken, refreshToken, profile, done) => {
      findOrCreateOAuthUser(db, 'google', profile, accessToken, refreshToken, done);
    }));
    console.log('✅ Google OAuth strategy configured');
  } else {
    console.warn('⚠️ Google OAuth not configured - GOOGLE_CLIENT_ID missing or placeholder');
  }

  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id') {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'displayName', 'emails', 'photos']
    }, (accessToken, refreshToken, profile, done) => {
      findOrCreateOAuthUser(db, 'facebook', profile, accessToken, refreshToken, done);
    }));
    console.log('✅ Facebook OAuth strategy configured');
  } else {
    console.warn('⚠️ Facebook OAuth not configured - FACEBOOK_APP_ID missing or placeholder');
  }

  if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_KEY !== 'your_twitter_key') {
    try {
      passport.use(new TwitterStrategy({
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        callbackURL: process.env.TWITTER_CALLBACK_URL,
        includeEmail: true
      }, (token, tokenSecret, profile, done) => {
        findOrCreateOAuthUser(db, 'twitter', profile, token, tokenSecret, done);
      }));
      console.log('✅ Twitter OAuth strategy configured');
    } catch (error) {
      console.warn('Twitter OAuth strategy not configured properly:', error.message);
    }
  } else {
    console.warn('⚠️ Twitter OAuth not configured - TWITTER_CONSUMER_KEY missing or placeholder');
  }

  passport.serializeUser((user, done) => {
    done(null, user.user_id);
  });

  passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM Users WHERE user_id = ?', [id], (err, user) => {
      done(err, user);
    });
  });

  function findOrCreateOAuthUser(db, provider, profile, accessToken, refreshToken, done) {
    const oauth_id = profile.id;
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${provider}-${profile.id}@oauth.local`;
    const name = profile.displayName || profile.name?.givenName || 'User';
    const [first_name, last_name] = name.split(' ').length > 1 ? name.split(' ') : [name, ''];
    const profile_picture = profile.photos && profile.photos[0] ? 
      (profile.photos[0].value || (typeof profile.photos[0] === 'string' ? profile.photos[0] : null)) : null;

    db.get('SELECT * FROM Users WHERE oauth_provider = ? AND oauth_id = ?', [provider, oauth_id], (err, user) => {
      if (err) return done(err);

      if (user) {
        db.run(
          'UPDATE Users SET oauth_token = ?, oauth_refresh_token = ?, profile_picture = COALESCE(?, profile_picture), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [accessToken, refreshToken || user.oauth_refresh_token, profile_picture, user.user_id],
          (updateErr) => {
            done(updateErr, user);
          }
        );
      } else {
        db.get('SELECT * FROM Users WHERE email = ?', [email], (checkErr, existingUser) => {
          if (checkErr) return done(checkErr);

          if (existingUser) {
            db.run(
              'UPDATE Users SET oauth_provider = ?, oauth_id = ?, oauth_token = ?, oauth_refresh_token = ?, profile_picture = COALESCE(?, profile_picture), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
              [provider, oauth_id, accessToken, refreshToken, profile_picture, existingUser.user_id],
              (updateErr) => {
                if (updateErr) return done(updateErr);
                db.get('SELECT * FROM Users WHERE user_id = ?', [existingUser.user_id], (selectErr, updatedUser) => {
                  done(selectErr, updatedUser);
                });
              }
            );
          } else {
            db.run(
              `INSERT INTO Users (email, first_name, last_name, oauth_provider, oauth_id, oauth_token, oauth_refresh_token, profile_picture, user_type, role)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'visitor', 'user')`,
              [email, first_name, last_name || '', provider, oauth_id, accessToken, refreshToken, profile_picture],
              function(insertErr) {
                if (insertErr) return done(insertErr);
                db.get('SELECT * FROM Users WHERE user_id = ?', [this.lastID], (selectErr, newUser) => {
                  done(selectErr, newUser);
                });
              }
            );
          }
        });
      }
    });
  }

  const generateToken = (user) => {
    return jwt.sign(
      { user_id: user.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  };

  const verifyToken = (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  };

  const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    
    req.user = decoded;
    next();
  };

  return {
    passport,
    generateToken,
    verifyToken,
    requireAuth
  };
};
