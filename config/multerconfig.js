<<<<<<< HEAD
const multer = require("multer");
=======
const multer =require("multer");
>>>>>>> b757ea66bb9ecb7181eca0ddca76f87fcadb830d
const crypto = require("crypto");
const path = require("path");

const storage = multer.diskStorage({
<<<<<<< HEAD
    destination: function (req, file, cb) {
        cb(null, "./public/images/upload");
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(8, function (err, name) {
            if (err) return cb(err);
            cb(null, `${name.toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
        });
    }
});

const fileFilter = function (req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("INVALID_IMAGE_TYPE"));
    cb(null, true);
};

module.exports = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});
=======
    destination: function(req, file, cb){
        cb(null, "./public/images/upload");
    },
    filename: function(req, file, cb){
        crypto.randomBytes(5, function(err, name){
           const uniqueName = name.toString("hex") + path.extname(file.originalname);
            cb(null, uniqueName);
        })
    }
})

const upload = multer({storage: storage});
module.exports= upload;
>>>>>>> b757ea66bb9ecb7181eca0ddca76f87fcadb830d
