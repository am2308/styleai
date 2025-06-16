import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import wardrobeRoutes from './routes/wardrobe.js';
import recommendationRoutes from './routes/recommendations.js';
import marketplaceRoutes from './routes/marketplace.js';
import subscriptionRoutes from './routes/subscription.js';
import { errorHandler } from './middleware/errorHandler.js';
import { testAWSConnection } from './config/aws.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables for LOCAL development only
const requiredEnvVars = [
  'JWT_SECRET'
];

// Only check AWS credentials in local development
if (process.env.NODE_ENV !== 'production') {
  requiredEnvVars.push('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION');
}

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  
  // Only exit in local development
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', async (req, res) => {
  const awsStatus = await testAWSConnection();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    aws: awsStatus ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting StyleAI Backend Server...');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Test AWS connection before starting (only in development)
    if (process.env.NODE_ENV !== 'production') {
      const awsConnected = await testAWSConnection();
      if (!awsConnected) {
        console.warn('⚠️  AWS connection failed, but server will continue to start');
        console.warn('   Please check your AWS credentials and configuration');
      }
    }
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`💳 Subscription system enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
