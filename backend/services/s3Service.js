import { PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET } from '../config/aws.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export const uploadImageToS3 = async (file, userId, category) => {
  try {
    console.log('🔄 Starting S3 upload process...');
    console.log('File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer?.length,
      encoding: file.encoding
    });
    console.log('Upload params:', { userId, category, bucket: S3_BUCKET });

    // Comprehensive validation
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('Invalid file: No file buffer or empty buffer');
    }

    if (!S3_BUCKET) {
      throw new Error('S3_BUCKET environment variable is not set');
    }

    if (!userId || !category) {
      throw new Error('userId and category are required');
    }

    // Validate file type and size
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new Error('File size too large. Maximum size is 5MB');
    }

    // Generate secure filename
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`Invalid file extension: ${fileExtension}. Allowed: ${allowedExtensions.join(', ')}`);
    }

    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const sanitizedCategory = category.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `wardrobe/${userId}/${sanitizedCategory}/${timestamp}-${uniqueId}${fileExtension}`;

    console.log('Generated filename:', fileName);

    // Prepare upload parameters with enhanced settings
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.buffer.length,
      ACL: 'public-read',
      // Enhanced metadata
      Metadata: {
        'uploaded-by': userId,
        'category': category,
        'original-name': Buffer.from(file.originalname, 'utf8').toString('base64'), // Encode to handle special chars
        'upload-timestamp': timestamp.toString(),
        'file-size': file.size.toString()
      },
      // Cache and content settings
      CacheControl: 'max-age=31536000, public', // 1 year cache
      ContentDisposition: 'inline', // Display in browser
      // Add checksum for integrity
      ChecksumAlgorithm: 'SHA256'
    };

    console.log('Upload parameters:', {
      Bucket: uploadParams.Bucket,
      Key: uploadParams.Key,
      ContentType: uploadParams.ContentType,
      ContentLength: uploadParams.ContentLength,
      ACL: uploadParams.ACL,
      BufferPreview: file.buffer.slice(0, 20).toString('hex') // First 20 bytes for debugging
    });

    // Upload to S3 with retry logic
    console.log('📤 Uploading to S3...');
    let uploadResult;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const command = new PutObjectCommand(uploadParams);
        uploadResult = await s3Client.send(command);
        console.log('✅ S3 upload successful on attempt', retryCount + 1, ':', uploadResult);
        break;
      } catch (uploadError) {
        retryCount++;
        console.warn(`⚠️ Upload attempt ${retryCount} failed:`, uploadError.message);
        
        if (retryCount >= maxRetries) {
          throw uploadError;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // Construct the public URL with proper region
    const region = process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1';
    const imageUrl = `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${fileName}`;
    
    console.log('🔗 Generated image URL:', imageUrl);

    // Verify the upload by checking if the object exists and has correct size
    try {
      console.log('🔍 Verifying upload...');
      const headCommand = new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
      });
      const headResult = await s3Client.send(headCommand);
      
      console.log('✅ Upload verification successful:', {
        ContentLength: headResult.ContentLength,
        ContentType: headResult.ContentType,
        LastModified: headResult.LastModified,
        ETag: headResult.ETag
      });

      // Verify file size matches
      if (headResult.ContentLength !== file.buffer.length) {
        throw new Error(`File size mismatch: uploaded ${headResult.ContentLength} bytes, expected ${file.buffer.length} bytes`);
      }

      // Verify content type matches
      if (headResult.ContentType !== file.mimetype) {
        console.warn(`⚠️ Content type mismatch: uploaded ${headResult.ContentType}, expected ${file.mimetype}`);
      }

    } catch (verifyError) {
      console.error('❌ Upload verification failed:', verifyError);
      throw new Error(`Upload verification failed: ${verifyError.message}`);
    }

    // Test URL accessibility (optional but helpful for debugging)
    try {
      console.log('🌐 Testing URL accessibility...');
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ URL is accessible');
      } else {
        console.warn('⚠️ URL may not be immediately accessible (this is sometimes normal)');
      }
    } catch (urlError) {
      console.warn('⚠️ Could not test URL accessibility:', urlError.message);
      // Don't fail the upload for this
    }

    return imageUrl;

  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId
    });
    
    // Provide specific error messages
    if (error.name === 'NoSuchBucket') {
      throw new Error(`S3 bucket '${S3_BUCKET}' does not exist or is not accessible`);
    } else if (error.name === 'AccessDenied') {
      throw new Error('Access denied to S3 bucket. Check your AWS credentials and bucket permissions');
    } else if (error.name === 'InvalidAccessKeyId') {
      throw new Error('Invalid AWS access key ID. Check your AWS credentials');
    } else if (error.name === 'SignatureDoesNotMatch') {
      throw new Error('AWS signature mismatch. Check your AWS secret access key');
    } else if (error.code === 'NetworkingError') {
      throw new Error('Network error while uploading to S3. Check your internet connection');
    } else if (error.message.includes('File size mismatch')) {
      throw new Error('File upload corrupted. Please try again with a different image');
    }
    
    throw new Error(`S3 upload failed: ${error.message}`);
  }
};

export const deleteImageFromS3 = async (imageUrl) => {
  try {
    console.log('🗑️ Deleting image from S3:', imageUrl);
    
    if (!imageUrl || !imageUrl.includes(S3_BUCKET)) {
      console.log('⚠️ Invalid image URL or not from our S3 bucket, skipping deletion');
      return;
    }

    // Extract the key from the URL
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    console.log('Extracted S3 key:', key);

    const deleteParams = {
      Bucket: S3_BUCKET,
      Key: key,
    };

    const command = new DeleteObjectCommand(deleteParams);
    const result = await s3Client.send(command);
    
    console.log('✅ S3 deletion successful:', result);

  } catch (error) {
    console.error('❌ S3 deletion failed:', error);
    // Don't throw error for deletion failures as it's not critical
    console.warn('⚠️ Continuing despite S3 deletion failure');
  }
};

// Enhanced S3 connection test
export const testS3Connection = async () => {
  try {
    console.log('🧪 Testing S3 connection...');
    
    if (!S3_BUCKET) {
      throw new Error('S3_BUCKET environment variable is not set');
    }

    // Test by checking if bucket exists and is accessible
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const command = new HeadBucketCommand({
      Bucket: S3_BUCKET
    });
    
    const result = await s3Client.send(command);
    console.log('✅ S3 connection test successful');
    console.log('Bucket info:', {
      name: S3_BUCKET,
      region: process.env.S3_REGION || process.env.AWS_REGION,
      accessible: true
    });
    
    return true;
  } catch (error) {
    console.error('❌ S3 connection test failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    console.error('Please check:');
    console.error('1. S3_BUCKET environment variable is set correctly');
    console.error('2. AWS credentials have proper S3 permissions');
    console.error('3. S3 bucket exists and is accessible');
    console.error('4. AWS region is correct');
    console.error('5. Bucket policy allows public read access');
    
    return false;
  }
};