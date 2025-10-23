#!/usr/bin/env node

const { db, connectDB } = require('../src/config/database');
const logger = require('../src/utils/logger');

const setupDatabase = async () => {
  try {
    logger.info('🚀 Starting database setup...');
    
    // Connect to database
    await connectDB();
    
    // Run migrations
    logger.info('📊 Running database migrations...');
    await db.migrate.latest();
    
    // Clean up expired OTPs
    logger.info('🧹 Cleaning up expired OTPs...');
    const otpService = require('../src/services/otpService');
    await otpService.cleanExpiredOTPs();
    
    logger.info('✅ Database setup completed successfully!');
    logger.info('📋 Available tables:');
    
    // List all tables
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    tables.rows.forEach(table => {
      logger.info(`  - ${table.table_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();
