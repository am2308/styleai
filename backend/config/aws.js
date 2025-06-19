import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

// Validate environment variables - Enhanced for better debugging
const validateAWSConfig = () => {
  console.log('🔧 Validating AWS Configuration...');
  
  const required = ['AWS_REGION'];
  const optional = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET'];
  
  // Check required variables
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required AWS environment variables: ${missing.join(', ')}`);
  }
  
  console.log('AWS Configuration Status:');
  console.log('✅ Region:', process.env.AWS_REGION);
  
  // Check credentials (different handling for Lambda vs local)
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.log('🔧 Running in AWS Lambda - using IAM role credentials');
  } else {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('✅ AWS Access Key ID:', process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...');
      console.log('✅ AWS Secret Access Key: [CONFIGURED]');
    } else {
      console.log('⚠️  AWS credentials not found in environment variables');
      console.log('   Will attempt to use default credential chain (IAM roles, etc.)');
    }
  }
  
  // Check S3 configuration
  if (process.env.S3_BUCKET) {
    console.log('✅ S3 Bucket:', process.env.S3_BUCKET);
    console.log('✅ S3 Region:', process.env.S3_REGION || process.env.AWS_REGION);
  } else {
    console.warn('⚠️  S3_BUCKET not configured - image uploads will fail');
  }
  
  // Check DynamoDB tables
  console.log('✅ Users Table:', process.env.USERS_TABLE || 'StyleAI_Users');
  console.log('✅ Wardrobe Table:', process.env.WARDROBE_TABLE || 'StyleAI_Wardrobe');
};

// Validate configuration on startup
try {
  validateAWSConfig();
} catch (error) {
  console.error('❌ AWS Configuration Error:', error.message);
  console.error('Please check your environment variables.');
  
  // Don't exit in Lambda environment, but warn
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.error('Exiting due to configuration error...');
    process.exit(1);
  }
}

// Enhanced AWS Configuration with better error handling
const awsConfig = {
  region: process.env.AWS_REGION || 'ap-south-1',
  // Only specify credentials if they exist (let SDK use default chain otherwise)
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  })
};

console.log('🔧 AWS SDK Configuration:', {
  region: awsConfig.region,
  hasCredentials: !!awsConfig.credentials,
  credentialSource: awsConfig.credentials ? 'environment' : 'default_chain'
});

// DynamoDB Configuration
const dynamoClient = new DynamoDBClient(awsConfig);
export const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

// S3 Configuration with enhanced settings
export const s3Client = new S3Client({
  ...awsConfig,
  region: process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1',
  // Add additional S3-specific configuration
  forcePathStyle: false, // Use virtual-hosted-style URLs
  useAccelerateEndpoint: false, // Disable transfer acceleration by default
});

export const TABLES = {
  USERS: process.env.USERS_TABLE || 'StyleAI_Users',
  WARDROBE: process.env.WARDROBE_TABLE || 'StyleAI_Wardrobe',
};

export const S3_BUCKET = process.env.S3_BUCKET;

// Enhanced AWS connection test
export const testAWSConnection = async () => {
  try {
    console.log('🧪 Testing AWS connections...');
    
    // Test DynamoDB connection
    try {
      const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb');
      const result = await dynamoClient.send(new ListTablesCommand({}));
      console.log('✅ DynamoDB connection successful');
      console.log(`   Found ${result.TableNames?.length || 0} tables`);
      
      // Check if our tables exist
      const tableNames = result.TableNames || [];
      const ourTables = Object.values(TABLES);
      const missingTables = ourTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.warn('⚠️  Missing DynamoDB tables:', missingTables.join(', '));
        console.warn('   Run the table creation script to create missing tables');
      } else {
        console.log('✅ All required DynamoDB tables exist');
      }
    } catch (dynamoError) {
      console.error('❌ DynamoDB connection failed:', dynamoError.message);
      throw new Error(`DynamoDB: ${dynamoError.message}`);
    }
    
    // Test S3 connection
    if (S3_BUCKET) {
      try {
        const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
        await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
        console.log('✅ S3 connection successful');
        console.log(`   Bucket '${S3_BUCKET}' is accessible`);
      } catch (s3Error) {
        console.error('❌ S3 connection failed:', s3Error.message);
        
        if (s3Error.name === 'NoSuchBucket') {
          console.error(`   Bucket '${S3_BUCKET}' does not exist`);
        } else if (s3Error.name === 'AccessDenied') {
          console.error(`   Access denied to bucket '${S3_BUCKET}'`);
        }
        
        throw new Error(`S3: ${s3Error.message}`);
      }
    } else {
      console.warn('⚠️  S3_BUCKET not configured - skipping S3 test');
    }
    
    return true;
  } catch (error) {
    console.error('❌ AWS connection test failed:', error.message);
    return false;
  }
};

export { dynamoClient };