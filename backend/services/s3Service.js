import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
      bufferLength: file.buffer?.length
    });
    console.log('Upload params:', { userId, category, bucket: S3_BUCKET });

    // Validate inputs
    if (!file || !file.buffer) {
      throw new Error('Invalid file: No file buffer provided');
    }

    if (!S3_BUCKET) {
      throw new Error('S3_BUCKET environment variable is not set');
    }

    if (!userId || !category) {
      throw new Error('userId and category are required');
    }

    // Generate unique filename with proper extension
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`Invalid file extension: ${fileExtension}. Allowed: ${allowedExtensions.join(', ')}`);
    }

    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const fileName = `${userId}/${category}/${timestamp}-${uniqueId}${fileExtension}`;

    console.log('Generated filename:', fileName);

    // Prepare upload parameters
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.buffer.length,
      // Make the object publicly readable
      ACL: 'public-read',
      // Add metadata
      Metadata: {
        'uploaded-by': userId,
        'category': category,
        'original-name': file.originalname,
        'upload-timestamp': timestamp.toString()
      },
      // Cache control for better performance
      CacheControl: 'max-age=31536000', // 1 year
    };

    console.log('Upload parameters:', {
      Bucket: uploadParams.Bucket,
      Key: uploadParams.Key,
      ContentType: uploadParams.ContentType,
      ContentLength: uploadParams.ContentLength,
      ACL: uploadParams.ACL
    });

    // Upload to S3
    console.log('📤 Uploading to S3...');
    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);
    
    console.log('✅ S3 upload successful:', result);

    // Construct the public URL
    const region = process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1';
    const imageUrl = `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${fileName}`;
    
    console.log('🔗 Generated image URL:', imageUrl);

    // Verify the upload by checking if the object exists
    try {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const headCommand = new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: fileName
      });
      const headResult = await s3Client.send(headCommand);
      console.log('✅ Upload verification successful:', {
        ContentLength: headResult.ContentLength,
        ContentType: headResult.ContentType,
        LastModified: headResult.LastModified
      });
    } catch (verifyError) {
      console.warn('⚠️ Could not verify upload (but upload may have succeeded):', verifyError.message);
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
    
    // Provide more specific error messages
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

// Test S3 connection and permissions
export const testS3Connection = async () => {
  try {
    console.log('🧪 Testing S3 connection...');
    
    if (!S3_BUCKET) {
      throw new Error('S3_BUCKET environment variable is not set');
    }

    // Test by listing bucket contents (this requires ListBucket permission)
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      MaxKeys: 1 // Just test with 1 object
    });
    
    const result = await s3Client.send(command);
    console.log('✅ S3 connection test successful');
    console.log('Bucket info:', {
      name: S3_BUCKET,
      region: process.env.S3_REGION || process.env.AWS_REGION,
      objectCount: result.KeyCount || 0
    });
    
    return true;
  } catch (error) {
    console.error('❌ S3 connection test failed:', error);
    console.error('Please check:');
    console.error('1. S3_BUCKET environment variable is set correctly');
    console.error('2. AWS credentials have proper S3 permissions');
    console.error('3. S3 bucket exists and is accessible');
    console.error('4. AWS region is correct');
    return false;
  }
};