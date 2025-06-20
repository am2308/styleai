import multer from 'multer';
import path from 'path';

// Use memory storage for S3 uploads - CRITICAL for proper file handling
const storage = multer.memoryStorage();

// Enhanced file filter with comprehensive validation
const fileFilter = (req, file, cb) => {
  console.log('📁 File filter validation:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
    size: file.size
  });

  // Allowed file types - be very specific
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp'
  ];
  
  const allowedExtensions = /\.(jpeg|jpg|png|webp)$/i;
  
  // Validate MIME type
  const mimetypeValid = allowedMimeTypes.includes(file.mimetype);
  
  // Validate file extension
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  
  // Additional validation for file name
  const hasValidName = file.originalname && file.originalname.length > 0;
  
  if (mimetypeValid && extname && hasValidName) {
    console.log('✅ File validation passed');
    return cb(null, true);
  } else {
    console.log('❌ File validation failed:', {
      mimetypeValid,
      extname,
      hasValidName,
      receivedMimetype: file.mimetype,
      receivedExtension: path.extname(file.originalname),
      fileName: file.originalname
    });
    
    let errorMessage = 'Invalid file. ';
    if (!hasValidName) errorMessage += 'File name is required. ';
    if (!mimetypeValid) errorMessage += `Invalid file type: ${file.mimetype}. `;
    if (!extname) errorMessage += `Invalid extension: ${path.extname(file.originalname)}. `;
    errorMessage += 'Only JPEG, JPG, PNG, and WEBP images are allowed.';
    
    const error = new Error(errorMessage);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error);
  }
};

// Enhanced multer configuration with strict limits
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only allow 1 file
    fields: 10, // Limit number of fields
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024, // 1MB field size limit
    parts: 20 // Limit number of parts
  },
  fileFilter,
  // Preserve file extensions and handle encoding properly
  preservePath: false,
  // Handle errors gracefully
  onError: (err, next) => {
    console.error('❌ Multer configuration error:', err);
    next(err);
  }
});

// Comprehensive error handler for all upload-related errors
export const handleUploadError = (error, req, res, next) => {
  console.error('📤 Upload error details:', {
    name: error.name,
    message: error.message,
    code: error.code,
    field: error.field,
    stack: error.stack
  });

  // Handle Multer-specific errors
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: 'File size too large. Maximum size is 5MB.',
          code: 'FILE_TOO_LARGE',
          maxSize: '5MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          error: 'Too many files. Only 1 file is allowed.',
          code: 'TOO_MANY_FILES',
          maxFiles: 1
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          error: 'Unexpected file field. Use "image" as the field name.',
          code: 'UNEXPECTED_FIELD',
          expectedField: 'image'
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
      code: 'INVALID_FILE_TYPE',
      allowedTypes: ['JPEG', 'JPG', 'PNG', 'WEBP']
    });
  }

  // Handle other file-related errors
  if (error.message && error.message.includes('file')) {
    return res.status(400).json({
      error: `File processing error: ${error.message}`,
      code: 'FILE_PROCESSING_ERROR'
    });
  }

  // Pass other errors to the general error handler
  next(error);
};

// Middleware to validate file after multer processing
export const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded. Please select an image file.',
      code: 'NO_FILE_UPLOADED'
    });
  }

  // Additional validation after multer
  if (!req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({
      error: 'Uploaded file is empty or corrupted. Please try again.',
      code: 'EMPTY_FILE_BUFFER'
    });
  }

  // Validate file signature (magic numbers) for additional security
  const fileSignature = req.file.buffer.slice(0, 4).toString('hex').toLowerCase();
  const validSignatures = {
    'ffd8ffe0': 'JPEG',
    'ffd8ffe1': 'JPEG',
    'ffd8ffe2': 'JPEG',
    'ffd8ffe3': 'JPEG',
    'ffd8ffe8': 'JPEG',
    '89504e47': 'PNG',
    '52494646': 'WEBP' // First 4 bytes of RIFF
  };

  const isValidSignature = Object.keys(validSignatures).some(sig => 
    fileSignature.startsWith(sig)
  );

  if (!isValidSignature) {
    console.warn('⚠️ Invalid file signature:', fileSignature);
    return res.status(400).json({
      error: 'Invalid image file. The file may be corrupted or not a valid image.',
      code: 'INVALID_FILE_SIGNATURE'
    });
  }

  console.log('✅ File validation passed:', {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    signature: fileSignature,
    detectedType: validSignatures[Object.keys(validSignatures).find(sig => fileSignature.startsWith(sig))]
  });

  next();
};