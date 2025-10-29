const knex = require('knex');
const { logger } = require('../utils/logger');

const dbConfig = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'zyra_db',
    user: process.env.DB_USER || 'zyra_user',
    password: process.env.DB_PASSWORD || 'zyra_password',
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

const db = knex(dbConfig);

const connectDB = async () => {
  try {
    // Test database connection
    await db.raw('SELECT 1');
    logger.info('✅ Database connected successfully');
    
    // Run migrations (commented out since tables already exist)
    // await db.migrate.latest();
    // logger.info('✅ Database migrations completed');
    
    return db;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    await db.raw('SELECT 1');
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

module.exports = {
  db,
  connectDB,
  checkDatabaseHealth
};

