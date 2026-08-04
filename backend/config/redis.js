// REDIS COMMENTED OUT FOR TESTING PURPOSE (Code preserved below)
/*
const { createClient } = require('redis');


let rawRedisUrl = process.env.REDIS_URL ? String(process.env.REDIS_URL).trim() : '';


// Auto-clean: Extract valid URL if redis-cli command wrapper was pasted in REDIS_URL
if (rawRedisUrl.includes('redis://') || rawRedisUrl.includes('rediss://')) {
  const match = rawRedisUrl.match(/(rediss?:\/\/[^\s"']+)/);
  if (match) {
    rawRedisUrl = match[1];
  }
}
*/


let redisClient = null;


/*
if (!rawRedisUrl) {
  console.warn('⚠️ REDIS_URL environment variable is missing or empty in backend/.env');
} else {
  console.log('🔄 Initializing Redis...');
  try {
    redisClient = createClient({
      url: rawRedisUrl,
    });


    redisClient.on('connect', () => {
      console.log('✅ Redis Connected');
    });


    redisClient.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
    });


    (async () => {
      try {
        await redisClient.connect();
      } catch (err) {
        console.error('❌ Redis connection failed:', err.message);
      }
    })();
  } catch (err) {
    console.error('❌ Redis Client Initialization Error:', err.message);
  }
}
*/


module.exports = redisClient || {
  get: async () => null,
  set: async () => null,
  del: async () => null,
  isOpen: false,
};



