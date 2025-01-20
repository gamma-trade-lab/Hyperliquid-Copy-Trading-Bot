
export default async function handler(req: { method: string; }, res: { status: (arg0: number) => { (): any; new(): any; json: { (arg0: { error: string; }): void; new(): any; }; }; }) {
    if (req.method === 'POST') {
      // Handle Telegram updates here
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  }