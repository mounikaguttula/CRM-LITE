const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });


// Redis Initialization (Commented out for testing)
// require('./config/redis');


const errorHandler = require('./middleware/errorHandler');


// Route Imports
const authRoutes = require('./routes/auth');
const accessRequestRoutes = require('./routes/accessRequestRoutes');
const metadataRoutes = require('./routes/metadataRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const validationRuleRoutes = require('./routes/validationRuleRoutes');
const objectRoutes = require('./routes/objectRoutes');
const leadScannerRoutes = require('./routes/leadScannerRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const publicRoutes = require('./routes/publicRoutes');
const companyRoutes = require('./routes/companyRoutes');
const formRoutes = require('./routes/formRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const importRoutes = require('./routes/importRoutes');
const segmentRoutes = require('./routes/segmentRoutes');



const app = express();
const PORT = process.env.PORT || 5000;


// CORS Configuration
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:3001']
  : '*';


app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));


// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static Assets – email icons and images (publicly accessible for email clients)
app.use('/email-assets', express.static(path.join(__dirname, 'public', 'email-assets')));



// Health Check Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'FounderCRM Metadata-Driven CRM Platform Engine',
    architecture: 'Clean Metadata Platform Architecture',
    timestamp: new Date().toISOString(),
  });
});


app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.env.UPTIME || process.uptime(),
    timestamp: new Date().toISOString(),
  });
});


// API Routes Mount
app.use('/api/public', publicRoutes);
app.use('/auth', authRoutes);
app.use('/validation-rules', validationRuleRoutes);
app.use('/api/validation-rules', validationRuleRoutes);
app.use('/', companyRoutes);
app.use('/api', companyRoutes);
app.use('/', leadScannerRoutes);
app.use('/', campaignRoutes);
app.use('/', formRoutes);
app.use('/', segmentRoutes);
app.use('/api', segmentRoutes);
app.use('/', accessRequestRoutes);
app.use('/', metadataRoutes);
app.use('/', userRoutes);
app.use('/api', userRoutes);
app.use('/users', userRoutes);
app.use('/api/users', userRoutes);
app.use('/roles', roleRoutes);
app.use('/api/roles', roleRoutes);
app.use('/', dashboardRoutes);
app.use('/api', dashboardRoutes);
app.use('/', importRoutes);
app.use('/api', importRoutes);
app.use('/', objectRoutes);



// Global Error Handler (must be registered last)
app.use(errorHandler);


const validationRuleService = require('./services/validationRuleService');

// Start Server: resilient listener with background system rule verification
const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 FounderCRM Metadata Platform Engine running on http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  });

  try {
    await validationRuleService.ensureSystemRules();
    console.log('✅ Platform system validation rules verified.');
  } catch (err) {
    console.warn('⚠️ Warning: System validation rules initialization deferred or failed:', err.message || err);
  }
};

startServer();



