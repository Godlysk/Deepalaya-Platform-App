const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');

const MONGO_URI = "mongodb+srv://db_admin:deepalaya@deepalaya-project-horfs.gcp.mongodb.net/db?retryWrites=true&w=majority";
const options = {useNewUrlParser: true};

const dbName = "db";
const usersCollection = "users";
const modulesCollection = "modules";
const uploadCollection = "uploads";

var upload = null;
var gfs = null;

const dataset = {
    db: null,
    users: null,
    modules: null,
    files: null
};

// Connect to DB
const connect = (callback) => {
    // Exit if database is already stored
    if (dataset.db) callback();
    else {
        mongoClient.connect(MONGO_URI, options, (err, client) => { 
            if (err) callback(err);
            dataset.db = client.db(dbName);

            // Get Users
            client.db(dbName).collection(usersCollection).find({}).toArray((err, documents) => {
                if (err) callback(err);
                else dataset.users = (documents);
                // No callback here, as we want to also gather module data as well
            });

            // Get Modules
            client.db(dbName).collection(modulesCollection).find({}).toArray((err, documents) => {
                if (err) callback(err);
                else dataset.modules = (documents);
                callback(); // Exit after module data gathered
            });
        });
    } 
};


const initializeStorage = () => {

    gfs = Grid(dataset.db, mongodb);
    gfs.collection(uploadCollection);

    const storageEngine = new GridFsStorage({  
        url: MONGO_URI,  
        file: (request, file) => {    
            return {          
                filename: file.originalname,
                metadata: {
                    assignment_id: mongodb.ObjectID(request.params.assignment_id),
                    uploader: request.user.username,
                    uploader_id: mongodb.ObjectID(request.user._id)
                },
                bucketName: uploadCollection
            }
        }
    });

    storageEngine.on('connection', (db) => {
        upload = multer({storage: storageEngine}).single('file');  
    });
    
}

// Read Functions

const getDatabase = () => { return dataset.db; };
const getUsers = () => { return dataset.users; };
const getModules = () => { return dataset.modules; };
const getFiles = () => { return dataset.files; };

// Load, Write functions

const removeModule = (request, response, next) => {
    dataset.db.collection(modulesCollection).deleteOne({_id: mongodb.ObjectID(request.params.id)}, (err, res) => {
        if (err) throw err;
        next();
    });
}

const loadSpecificModules = (request, response, next) => {
    dataset.db.collection(modulesCollection).find({grade: request.params.grade, subject: request.params.subject}).toArray((err, documents) => {
        if (err) throw err;
        else dataset.modules = (documents);
        next();
    });
}

const loadModuleByID = (request, response, next) => {
    dataset.db.collection(modulesCollection).find({_id: mongodb.ObjectID(request.params.id)}).toArray((err, documents) => {
        if (err) throw err;
        else dataset.modules = (documents);
        next();
    });
}

const addModule = (request, response, next) => {

    var sanitized_file_locator = request.body.file_locator;
    
    if (request.body.type == "video") 
        sanitized_file_locator = request.body.file_locator.replace("https://www.youtube.com/watch?v=", "https://www.youtube.com/embed/");
    else if (request.body.type == "image")
        sanitized_file_locator = request.body.file_locator.replace("view?usp=sharing", "preview");

    var newModule = {
        subject: request.params.subject,
        grade: request.params.grade,
        title: request.body.title,
        type: request.body.type,
        file_locator: sanitized_file_locator,
        description: request.body.description
    };

    dataset.db.collection(modulesCollection).insertOne(newModule, (err, res) => {  
        if (err) throw err;
        next();
    });
}

const uploadFile = (request, response, next) => {
    upload(request, response, (err) => {
        if (err) throw err;
        else return next();
    });
}

const removeFile = (request, response, next) => {

    gfs.remove({_id: request.params.id, root: uploadCollection}, (err, gridStore) => {
        if (err) throw err;
        else return next();
    });

}

const downloadFile = (request, response, disposition) => {
    
    gfs.collection(uploadCollection)
    gfs.files.find({_id: mongodb.ObjectID(request.params.id)}).toArray(function(err, files){
        
        var readstream = gfs.createReadStream({
            _id: request.params.id,
            root: uploadCollection
        });
        
        response.set('Content-Type', files[0].contentType);
        response.set('Content-Disposition', disposition + "; filename=" + files[0].filename);
        return readstream.pipe(response);
        
    });
}

const loadAllFiles = async (request, response, next) => {

    gfs.collection(uploadCollection);
    await gfs.files.find({}).toArray((err, files) => {
        if (err) throw err;
        else {
            dataset.files = files;
            return next();
        }
    });
}

const loadFilesByAssignment = async (request, response, next) => {
    assignmentIDSupplied = request.params.id;

    gfs.collection(uploadCollection);
    await gfs.files.find({"metadata.assignment_id": mongodb.ObjectID(assignmentIDSupplied)}).toArray((err, files) => {
        if (err) throw err;
        else {
            dataset.files = files;
            return next();
        }
    });
}

const loadFilesByUploader = async (request, response, next) => {
    assignmentIDSupplied = request.params.id;
    uploaderIDSupplied = request.user._id;

    gfs.collection(uploadCollection);
    await gfs.files.find({ "metadata.assignment_id": mongodb.ObjectID(request.params.id), "metadata.uploader_id": mongodb.ObjectID(request.user._id)}).toArray((err, files) => {
        if (err) throw err;
        else {
            dataset.files = files;
            return next();
        }
    });
}


module.exports = {
    connect, initializeStorage,
    getDatabase, getUsers, getModules, getFiles, 
    loadSpecificModules, loadModuleByID,
    addModule, removeModule,
    uploadFile, removeFile, downloadFile,
    loadAllFiles, loadFilesByAssignment, loadFilesByUploader
};

