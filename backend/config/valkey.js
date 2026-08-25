const Redis = require('ioredis');

let client = null;
let isReady = false;

const connectValkey = async () => {
  if (client) return client;

  const valkeyUrl = process.env.VALKEY_URL || 'redis://localhost:6379';
  const isTls = valkeyUrl.startsWith('rediss://');

  try {
    // For Aiven (rediss://), we add tls options. For local (redis://), we don't.
    const options = isTls ? { tls: { rejectUnauthorized: false } } : {};
    
    client = new Redis(valkeyUrl, options);

    client.on('connect', () => {
      console.log('✅ Connected to Valkey');
    });

    client.on('ready', () => {
      isReady = true;
      console.log('🚀 Valkey is ready and caching is active');
    });

    client.on('error', (err) => {
      isReady = false;
      console.warn('🟡 Valkey connection error (Falling back to Supabase-only mode):', err.message);
    });

    client.on('end', () => {
      isReady = false;
    });

    return client;
  } catch (err) {
    isReady = false;
    console.warn('🟡 Failed to initialize Valkey client:', err.message);
    return null;
  }
};

const getClient = () => client;
const isValkeyReady = () => isReady;

module.exports = {
  connectValkey,
  getClient,
  isValkeyReady
};