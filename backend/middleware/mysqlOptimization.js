/**
 * MySQL Optimization Middleware
 * Sets MySQL session variables to optimize sort operations for large datasets
 */
const mysql = require('mysql2/promise');

let connection = null;

// Initialize a persistent connection for setting session variables
const initConnection = async () => {
  if (!connection) {
    const config = require('../config/database').sequelize.config;
    connection = await mysql.createConnection({
      host: config.host,
      user: config.username,
      password: config.password,
      database: config.database,
      multipleStatements: true
    });
  }
  return connection;
};

/**
 * Set MySQL session variables to optimize sort operations
 * This should be called before queries that sort large datasets
 */
const optimizeSortBuffer = async () => {
  try {
    const conn = await initConnection();
    // Set session variables to optimize sorting
    // sort_buffer_size: 16MB (default is usually 256KB-2MB)
    // read_buffer_size: 2MB
    // read_rnd_buffer_size: 4MB
    await conn.execute(`
      SET SESSION sort_buffer_size = 16777216;
      SET SESSION read_buffer_size = 2097152;
      SET SESSION read_rnd_buffer_size = 4194304;
    `);
  } catch (error) {
    console.error('Failed to set MySQL optimization variables:', error);
    // Don't throw - allow query to proceed with default settings
  }
};

/**
 * Middleware to optimize MySQL settings for requests that sort large datasets
 */
const mysqlOptimizationMiddleware = async (req, res, next) => {
  // Only optimize for GET requests that might involve sorting
  if (req.method === 'GET' && (req.path.includes('/commits') || req.path.includes('/reservations'))) {
    await optimizeSortBuffer();
  }
  next();
};

module.exports = {
  optimizeSortBuffer,
  mysqlOptimizationMiddleware
};
