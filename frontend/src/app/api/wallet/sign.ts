import { NextApiRequest, NextApiResponse } from 'next';
import { agentWallet } from '@/utils/wallet';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transaction, rpcUrl } = req.body;

  if (!transaction || !rpcUrl) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  try {
    const signature = await agentWallet.signAndSendTransaction(transaction);
    return res.status(200).json({ signature });
  } catch (error) {
    console.error('Error signing transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
