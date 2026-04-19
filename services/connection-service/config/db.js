const mysql = require('mysql2/promise');

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'linkedin_connections',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release();

    // Create the connections table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS connections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        connection_id VARCHAR(50) UNIQUE NOT NULL,
        requester_id VARCHAR(50) NOT NULL,
        receiver_id VARCHAR(50) NOT NULL,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_connection (requester_id, receiver_id),
        INDEX idx_requester (requester_id),
        INDEX idx_receiver (receiver_id),
        INDEX idx_status (status)
      )
    `);
    console.log('Connections table ready');
  } catch (error) {
    console.error('MySQL connection error:', error.message);
    process.exit(1);
  }
};

const getPool = () => pool;

module.exports = { connectDB, getPool };
