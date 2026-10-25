import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from((process.env.ENCRYPTION_KEY || '12345678901234567890123456789012').padEnd(32).slice(0, 32));

export const decryptPayloadMiddleware = (req, res, next) => {
  if (!req.body || !req.body.payload) {
    return res.status(400).json({ error: 'Encrypted payload is missing' });
  }

  try {
    const parts = req.body.payload.split(':');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Invalid payload format. Expected IV:EncryptedData' });
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const parsedData = JSON.parse(decrypted.toString());
    req.body = parsedData;
    next();
  } catch (err) {
    return res.status(400).json({ error: 'Failed to decrypt payload. Invalid cipher key or corrupted data.' });
  }
};