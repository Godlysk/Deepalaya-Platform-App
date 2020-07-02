const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');
const methodOverride = require('method-override');
const db = require('./db');
const initializePassport = require('./pssprt');

const app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('method'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use((request, response, next) => {
    response.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    next();
});

const dataset = {
    users: null,
    modules: null,
    files: null
};

const port = process.env.PORT || 3000;

// Initialize the App

function initializeApp() {

    db.initializeStorage();

    // Copy the users, modules data
    dataset.users = (db.getUsers());
    dataset.modules = (db.getModules());

    // Set up the server at PORT 3000
    app.listen(port, () => {
        console.log('App listening on port ' + port);
    });

    initializePassport(passport, (username) => dataset.users.find((user) => user.username === username));
}

db.connect(async (err) => {
    if (err) throw err;
    else await initializeApp();
});


// GET Requests

app.get('/users', (request, response) => { response.send(dataset.users); });
app.get('/modules', (request, response) => { response.send(dataset.modules); });
app.get('/files', db.loadAllFiles, (request, response) => { 
    dataset.files = (db.getFiles());
    response.send(dataset.files); 
});

app.get('/', (request, response) => { response.redirect('/login'); });

app.get('/login', checkNotAuthenticated, (request, response) => {
    response.render('login');
});

app.get('/subjects', checkAuthenticated, (request, response) => {
    response.render('subjects', {user: request.user});
});

app.get('/subjects/:subject', checkTeacherSubject, (request, response) => {
    response.render('grades', {user: request.user, params: request.params});
});

app.get('/modules/:subject/grade/:grade', checkSubjectGrade, db.loadSpecificModules, (request, response) => {
    dataset.modules = (db.getModules());
    response.render('modules', {modules: dataset.modules, params: request.params, user: request.user});
});

app.get('/modules/:subject/grade/:grade/teacher/:id', checkTeacher, checkSubjectGrade, db.loadModuleByID, db.loadFilesByAssignment, (request, response) => {
    dataset.modules = (db.getModules());
    dataset.files = (db.getFiles());
    response.render('module-content', {chosenModule: dataset.modules[0], params: request.params, user: request.user, files: dataset.files});
});

app.get('/modules/:subject/grade/:grade/student/:id', checkStudent, checkSubjectGrade, db.loadModuleByID, db.loadFilesByUploader, (request, response) => {
    dataset.modules = (db.getModules());
    dataset.files = (db.getFiles());
    response.render('module-content', {chosenModule: dataset.modules[0], params: request.params, user: request.user, files: dataset.files});
});

// POST Requests

app.post('/login', passport.authenticate('local', {
    successRedirect: '/subjects',
    failureRedirect: '/login'
}));

app.delete('/logout', (request, response) => {
    request.logOut();
    response.redirect('/login');
});

app.post('/add/module/:subject/grade/:grade', db.addModule, (request, response) => { 
    response.redirect('/modules/' + request.params.subject + '/grade/' + request.params.grade);
});

app.post("/remove/module/:subject/grade/:grade/:id", db.removeModule, (request, response) => { 
    response.redirect('/modules/' + request.params.subject + '/grade/' + request.params.grade);
});

app.post('/upload/:subject/:grade/:assignment_id', db.uploadFile, async (request, response) => {
    response.redirect('/modules/' + request.params.subject + "/grade/" + request.params.grade + "/" + request.user.role + "/" + request.params.assignment_id);
});

app.post('/download/:id', async (request, response) => {
    db.downloadFile(request, response, "attachment");
});

app.delete('/remove/:subject/grade/:grade/:assignment_id/:id', db.removeFile, async (request, response) => {
    response.redirect('/modules/' + request.params.subject + "/grade/" + request.params.grade + "/" + request.user.role + "/" + request.params.assignment_id);
});


// Middleware

function checkAuthenticated(request, response, next) {
    if (request.isAuthenticated()) return next();
    response.redirect('/login');
}

function checkNotAuthenticated(request, response, next) {
    if (!request.isAuthenticated()) return next();
    response.redirect('/subjects');
}

function checkStudent(request, response, next) {
    if (request.isAuthenticated() && request.user.role == "student") return next();
    response.redirect('/login');
}

function checkTeacher(request, response, next) {
    if (request.isAuthenticated() && request.user.role == "teacher") return next();
    response.redirect('/login');
}

function checkTeacherSubject(request, response, next) {
    if (request.isAuthenticated()) {
        if (request.user.role == "teacher") {
            if (request.user.subjects.includes(request.params.subject)) return next();
        }
    }
    response.redirect('/login');
}

function checkSubjectGrade(request, response, next) {
    if (request.isAuthenticated()) {
        if (request.user.role == "teacher") {
            if (request.user.subjects.includes(request.params.subject) && request.user.grades.includes(request.params.grade)) return next();
        } else if (request.user.role == "student") {
            if (request.user.subjects.includes(request.params.subject) && request.user.grade == request.params.grade) return next();
        }
    }
    response.redirect('/login');
}

// Utility

async function getHashed(str) {
    try {
        const result = await bcrypt.hash(str, 10);
        console.log(result);
    } catch (e) {
        return done(e);
    }
}

