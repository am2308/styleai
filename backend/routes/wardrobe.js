import express from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth.js';
import { upload, handleUploadError, validateUploadedFile } from '../middleware/upload.js';
import { uploadImageToS3, deleteImageFromS3, testS3Connection } from '../services/s3Service.js';
import { 
  addWardrobeItem, 
  getUserWardrobeItems, 
  deleteWardrobeItem,
  getWardrobeItem 
} from '../services/wardrobeService.js';

const router = express.Router();

const wardrobeItemSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  category: Joi.string().valid('Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Footwear', 'Accessories').required(),
  color: Joi.string().required(),
});

// Test S3 connection endpoint (for debugging)
router.get('/test-s3', authenticateToken, async (req, res) => {
  try {
    console.log('🧪 Testing S3 connection for user:', req.user.id);
    const isConnected = await testS3Connection();
    
    res.json({ 
      s3Connected: isConnected,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || process.env.AWS_REGION,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ S3 test endpoint error:', error);
    res.status(500).json({ 
      error: 'S3 connection test failed',
      details: error.message,
      s3Connected: false
    });
  }
});

// Get user's wardrobe items
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    console.log('📋 Fetching wardrobe items for user:', req.user.id);
    const items = await getUserWardrobeItems(req.user.id);
    console.log(`✅ Found ${items.length} wardrobe items`);
    
    // Log image URLs for debugging
    items.forEach((item, index) => {
      console.log(`Item ${index + 1}: ${item.name} - Image: ${item.imageUrl}`);
    });
    
    res.json(items);
  } catch (error) {
    console.error('❌ Error fetching wardrobe items:', error);
    next(error);
  }
});

// Add wardrobe item with comprehensive image upload handling
router.post('/', authenticateToken, (req, res, next) => {
  console.log('📤 Starting wardrobe item upload for user:', req.user.id);
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  // Use multer middleware with comprehensive error handling
  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      console.error('❌ Multer upload error:', uploadErr);
      return handleUploadError(uploadErr, req, res, next);
    }

    // Validate uploaded file
    const fileValidationError = validateUploadedFile(req, res, () => {});
    if (fileValidationError) {
      return; // Response already sent by validateUploadedFile
    }

    try {
      console.log('📝 Processing wardrobe item upload...');
      console.log('Request body:', req.body);
      console.log('Uploaded file details:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        bufferLength: req.file.buffer?.length,
        encoding: req.file.encoding
      });

      // Validate form data
      const { error, value } = wardrobeItemSchema.validate(req.body);
      if (error) {
        console.error('❌ Form validation error:', error.details[0].message);
        return res.status(400).json({ 
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
      }

      console.log('✅ Form validation passed:', value);

      // Additional file buffer validation
      if (!req.file.buffer || req.file.buffer.length === 0) {
        console.error('❌ Empty file buffer detected');
        return res.status(400).json({ 
          error: 'Invalid file: empty or corrupted buffer',
          code: 'EMPTY_FILE_BUFFER'
        });
      }

      // Check if buffer contains valid image data
      const bufferStart = req.file.buffer.slice(0, 10).toString('hex');
      console.log('📊 File buffer preview (first 10 bytes):', bufferStart);

      console.log('☁️ Starting S3 upload...');

      // Upload image to S3 with comprehensive error handling
      let imageUrl;
      try {
        imageUrl = await uploadImageToS3(req.file, req.user.id, value.category);
        console.log('✅ S3 upload successful:', imageUrl);
      } catch (s3Error) {
        console.error('❌ S3 upload failed:', s3Error);
        return res.status(500).json({ 
          error: 'Failed to upload image to storage',
          details: s3Error.message,
          code: 'S3_UPLOAD_FAILED'
        });
      }

      console.log('💾 Saving item to database...');

      // Save item to database
      const item = await addWardrobeItem({
        ...value,
        userId: req.user.id,
        imageUrl,
      });

      console.log('✅ Wardrobe item created successfully:', {
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl
      });

      res.status(201).json(item);

    } catch (error) {
      console.error('❌ Error in wardrobe item creation:', error);
      next(error);
    }
  });
});

// Delete wardrobe item
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    console.log('🗑️ Deleting wardrobe item:', req.params.id, 'for user:', req.user.id);
    
    const item = await getWardrobeItem(req.params.id);
    
    if (!item) {
      console.log('❌ Item not found:', req.params.id);
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.userId !== req.user.id) {
      console.log('❌ Unauthorized deletion attempt by user:', req.user.id);
      return res.status(403).json({ error: 'Not authorized to delete this item' });
    }

    // Delete image from S3 (non-blocking)
    if (item.imageUrl) {
      console.log('🗑️ Deleting image from S3:', item.imageUrl);
      deleteImageFromS3(item.imageUrl).catch(error => {
        console.warn('⚠️ Failed to delete image from S3:', error.message);
        // Don't fail the request if S3 deletion fails
      });
    }

    // Delete item from database
    await deleteWardrobeItem(req.params.id, req.user.id);

    console.log('✅ Wardrobe item deleted successfully');
    res.json({ message: 'Item deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting wardrobe item:', error);
    next(error);
  }
});

export default router;