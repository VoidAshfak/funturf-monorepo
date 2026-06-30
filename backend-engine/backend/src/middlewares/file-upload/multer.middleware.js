import multer from "multer";


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp') //cb(custom_error_msg, file_path)
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`) //cb(custom_error_msg, file_name)
    }
})

export const upload = multer({ storage: storage }); 