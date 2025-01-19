import { NextResponse } from 'next/server';
import { validateSolanaAddress } from '@/utils/validation';

interface MintNFTRequest {
  recipient: string;
  name: string;
  image: string;
  description: string;   
}

interface CrossmintErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export async function POST(request: Request) {
  try {
    const { recipient, name, image, description } = await request.json() as MintNFTRequest;
    const crossmintApiKey = process.env.CROSSMINT_API_KEY;
    const crossmintCollectionId = process.env.CROSSMINT_COLLECTION_ID;

    if (!crossmintApiKey || !crossmintCollectionId) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!validateSolanaAddress(recipient)) {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
        { status: 400 }
      );
    }

    if (!image.startsWith('http')) {
      return NextResponse.json(
        { error: 'Invalid image URL' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://crossmint.com/api/2022-06-09/collections/${crossmintCollectionId}/nfts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': crossmintApiKey
        },
        body: JSON.stringify({
          recipient: `solana:${recipient}`,
          metadata: {
            name: name.trim(),
            image,
            description: description.trim()
          },
          compressed: true,
          reuploadLinkedFiles: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = data as CrossmintErrorResponse;
      console.error('Crossmint API error:', error);
      
      return NextResponse.json(
        { error: error.message || 'Failed to mint NFT' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('NFT minting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
