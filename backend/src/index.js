const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const otpRoutes = require('./routes/otpRoutes');
const otpService = require('./services/otpService');
const { initializeDatabase } = require('./config/db-init');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Finzip Backend API - Deployed via GitHub Actions 🚀");
});

// Routes
app.use('/api/otp', otpRoutes);

// Initialize database
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
});

// Schedule cleanup of expired OTPs every 6 hours
cron.schedule('0 */6 * * *', async () => {
  await otpService.cleanupExpiredOTPs();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0". () => {
  console.log(`Server is running on port ${PORT}`);
}); 
