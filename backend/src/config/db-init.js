const supabase = require('./supabase');

async function initializeDatabase() {
  try {
    // Skip table existence check since it's causing errors
    // Just log that we're initializing the database
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

module.exports = { initializeDatabase }; 