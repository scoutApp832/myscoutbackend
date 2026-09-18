const multer = require('multer');
const upload = require('../config/upload');

// Single file upload middleware
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    uploadMiddleware(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  };
};

// Multiple files upload middleware
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    uploadMiddleware(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  };
};

// Upload avatar
const uploadAvatar = uploadSingle('avatar');

// Upload documents
const uploadDocuments = uploadMultiple('documents', 5);

// Upload single document
const uploadDocument = uploadSingle('document');

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadAvatar,
  uploadDocuments,
  uploadDocument
};