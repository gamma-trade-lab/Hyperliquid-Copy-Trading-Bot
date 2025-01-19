import { NextApiRequest, NextApiResponse } from 'next';
import { agentWallet } from '@/utils/wallet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const balance = await agentWallet.getBalance();
    return res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
