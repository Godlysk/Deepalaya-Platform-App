const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

function init(passport, getUserByUsername) {
    const authenticateUser = async (username, password, callback) => {
        const existingUser = getUserByUsername(username);
        if (existingUser == null) return callback(null, false);
        else {
            try {
                const result = await bcrypt.compare(password, existingUser.password);
                if (result) return callback(null, existingUser);
                else return callback(null, false);
            } catch (e) {
                return callback(e);
            }
        }
    }

    passport.use(new localStrategy({usernameField: 'username', passwordField: 'password'}, authenticateUser));
    passport.serializeUser((user, done) => done(null, user.username));
    passport.deserializeUser((username, done) => {
        return done(null, getUserByUsername(username));
    });
}

module.exports = init;