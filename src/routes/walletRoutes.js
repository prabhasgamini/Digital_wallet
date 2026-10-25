import express from 'express';
import { prisma } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { decryptPayloadMiddleware } from '../middleware/decrypt.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.userId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    res.json({ userId: req.user.userId, username: req.user.username, balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ count: transactions.length, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deposit', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid deposit amount' });

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({
        where: { userId: req.user.userId },
        data: { balance: { increment: amount } }
      });

      await tx.transaction.create({
        data: {
          userId: req.user.userId,
          type: 'DEPOSIT',
          amount: amount,
          details: `Deposited ₹${amount}`
        }
      });

      return wallet;
    });

    res.json({ message: 'Deposit successful', balance: result.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/withdraw', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid withdraw amount' });

    const updatedWallet = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: req.user.userId } });
      if (!wallet || wallet.balance < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const updated = await tx.wallet.update({
        where: { userId: req.user.userId },
        data: { balance: wallet.balance - amount }
      });

      await tx.transaction.create({
        data: {
          userId: req.user.userId,
          type: 'WITHDRAW',
          amount: amount,
          details: `Withdrew ₹${amount}`
        }
      });

      return updated;
    });

    res.json({ message: 'Withdrawal successful', balance: updatedWallet.balance });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/transfer', decryptPayloadMiddleware, async (req, res) => {
  try {
    const { recipientUsername, amount } = req.body;
    if (!recipientUsername || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Recipient username and valid amount required' });
    }

    if (recipientUsername === req.user.username) {
      return res.status(400).json({ error: 'Cannot transfer to yourself' });
    }

    const recipientUser = await prisma.user.findUnique({ where: { username: recipientUsername } });
    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const senderWallet = await tx.wallet.findUnique({ where: { userId: req.user.userId } });
      if (!senderWallet || senderWallet.balance < amount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      await tx.wallet.update({
        where: { userId: req.user.userId },
        data: { balance: senderWallet.balance - amount }
      });

      await tx.wallet.update({
        where: { userId: recipientUser.id },
        data: { balance: { increment: amount } }
      });

      await tx.transaction.create({
        data: {
          userId: req.user.userId,
          type: 'TRANSFER_OUT',
          amount: amount,
          details: `Transferred ₹${amount} to ${recipientUsername}`
        }
      });

      await tx.transaction.create({
        data: {
          userId: recipientUser.id,
          type: 'TRANSFER_IN',
          amount: amount,
          details: `Received ₹${amount} from ${req.user.username}`
        }
      });

      return senderWallet.balance - amount;
    });

    res.json({ message: 'Encrypted transfer processed successfully', remainingBalance: result });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Insufficient balance for transfer' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;