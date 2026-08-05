const express = require('express');
const cors = require('cors');
require('dotenv').config();


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


// Health Check Endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'CRM Lite Metadata-Driven CRM Platform Engine',
    architecture: 'Clean Metadata Platform Architecture',
    timestamp: new Date().toISOString(),
  });
});


app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
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
app.use('/', accessRequestRoutes);
app.use('/', metadataRoutes);
app.use('/', userRoutes);
app.use('/api', userRoutes);
app.use('/users', userRoutes);
app.use('/api/users', userRoutes);
app.use('/roles', roleRoutes);
app.use('/api/roles', roleRoutes);
app.use('/', objectRoutes);


// Global Error Handler (must be registered last)
app.use(errorHandler);


// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 CRM Lite Metadata Platform Engine running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
});



