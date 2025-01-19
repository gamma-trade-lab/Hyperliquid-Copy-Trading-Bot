import { NextApiRequest, NextApiResponse } from 'next';
import { agentWallet } from '@/utils/wallet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipient, amount, rpcUrl } = req.body;

  if (!recipient || !amount || !rpcUrl) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
    const result = await agentWallet.sendSOL(recipient, amount);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error sending SOL:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
