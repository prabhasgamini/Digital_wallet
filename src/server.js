import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/wallet', walletRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Secure Digital Wallet REST API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});