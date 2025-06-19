import multer from 'multer';
import path from 'path';

// Use memory storage to keep files in memory for S3 upload
const storage = multer.memoryStorage();

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
  console.log('📁 File filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  // Allowed file types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ];
  
  const allowedExtensions = /\.(jpeg|jpg|png|webp)$/i;
  
  // Check MIME type
  const mimetypeValid = allowedMimeTypes.includes(file.mimetype);
  
  // Check file extension
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  
  if (mimetypeValid && extname) {
    console.log('✅ File validation passed');
    return cb(null, true);
  } else {
    console.log('❌ File validation failed:', {
      mimetypeValid,
      extname,
      receivedMimetype: file.mimetype,
      receivedExtension: path.extname(file.originalname)
    });
    
    const error = new Error(
      `Invalid file type. Only JPEG, JPG, PNG, and WEBP images are allowed. ` +
      `Received: ${file.mimetype} (${path.extname(file.originalname)})`
    );
    error.code = 'INVALID_FILE_TYPE';
    return cb(error);
  }
};

// Enhanced multer configuration
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only allow 1 file
    fields: 10, // Limit number of fields
  },
  fileFilter,
  // Add error handling for multer-specific errors
  onError: (err, next) => {
    console.error('❌ Multer error:', err);
    next(err);
  }
});

// Custom error handler for multer errors
export const handleUploadError = (error, req, res, next) => {
  console.error('📤 Upload error:', error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: 'File size too large. Maximum size is 5MB.',
          code: 'FILE_TOO_LARGE'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          error: 'Too many files. Only 1 file is allowed.',
          code: 'TOO_MANY_FILES'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          error: 'Unexpected file field. Use "image" field name.',
          code: 'UNEXPECTED_FIELD'
        });
      case 'LIMIT_PART_COUNT':
        return res.status(400).json({ 
          error: 'Too many parts in the request.',
          code: 'TOO_MANY_PARTS'
        });
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({ 
          error: 'Field name too long.',
          code: 'FIELD_NAME_TOO_LONG'
        });
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({ 
          error: 'Field value too long.',
          code: 'FIELD_VALUE_TOO_LONG'
        });
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({ 
          error: 'Too many fields.',
          code: 'TOO_MANY_FIELDS'
        });
      default:
        return res.status(400).json({ 
          error: `Upload error: ${error.message}`,
          code: 'UPLOAD_ERROR'
        });
    }
  }

  // Handle custom file filter errors
  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ 
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  // Pass other errors to the general error handler
  next(error);
};