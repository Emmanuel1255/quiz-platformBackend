const multer = require('multer');
const path = require('path');

// Set up memory storage for uploaded files
const storage = multer.memoryStorage();

// Define file filter
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedFileTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
  }
};

// Create the multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB max file size
  }
});

module.exports = { upload };