const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ Ensure all upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadDir, 'avatars');
const projectsDir = path.join(uploadDir, 'projects');
const documentsDir = path.join(uploadDir, 'documents');
const reportsDir = path.join(uploadDir, 'reports');
const certificatesDir = path.join(uploadDir, 'certificates');

const directories = [uploadDir, avatarsDir, projectsDir, documentsDir, reportsDir, certificatesDir];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ✅ Configure storage with dynamic destination
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest = avatarsDir;
    
    // Determine destination based on fieldname
    if (file.fieldname === 'avatar') {
      dest = avatarsDir;
    } else if (file.fieldname === 'document' || file.fieldname === 'file') {
      dest = projectsDir;
    } else if (file.fieldname === 'report') {
      dest = reportsDir;
    } else if (file.fieldname === 'certificate') {
      dest = certificatesDir;
    } else {
      dest = documentsDir;
    }
    
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    
    // For avatars, use user-specific naming
    if (file.fieldname === 'avatar' && req.user) {
      cb(null, `avatar-${req.user.id}-${uniqueSuffix}${ext}`);
    } else {
      // For documents, use timestamp-based naming
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
  }
});

// ✅ File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WEBP are allowed'), false);
  }
};

// ✅ File filter for documents
const documentFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed. Supported: PDF, Word, Excel, JPEG, PNG, GIF, WEBP`), false);
  }
};

// ✅ Create multer instances
const uploadAvatar = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter
});

const uploadDocument = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: documentFilter
});

// ✅ For backward compatibility - default upload (avatar)
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
});

module.exports = {
  upload,
  uploadAvatar,
  uploadDocument,
  // Individual uploads for specific use cases
  single: upload.single,
  avatar: uploadAvatar.single('avatar'),
  document: uploadDocument.single('document'),
  file: uploadDocument.single('file'),
  // For multiple files
  multiple: uploadDocument.array('documents', 5)
};