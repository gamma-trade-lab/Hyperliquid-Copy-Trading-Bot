import { getTrendingTokens } from '@/utils/birdeye';
import { NextResponse } from 'next/server';


// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, x-chain',
      },
    }
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const tokens = await getTrendingTokens(limit);
    
    // Add CORS headers to the response
    return NextResponse.json(
      {
        success: true,
        data: tokens
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, x-chain',
        },
      }
    );
  } catch (error) {
    console.error('Birdeye API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch trending tokens' 
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, x-chain',
        },
      }
    );
  }
}
