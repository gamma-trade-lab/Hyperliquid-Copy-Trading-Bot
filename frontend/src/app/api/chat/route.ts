import { streamCompletion } from '@/utils/groq';
import logger from '@/utils/logger';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';



// Message type for chat requests
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: Message[];
}

// Rate limiting implementation
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 20
};

// Simple in-memory store for rate limiting
const rateLimitStore = new Map<string, {
  count: number;
  timestamp: number;
}>();

// Clear old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.timestamp > RATE_LIMIT.WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT.WINDOW_MS);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const userRateLimit = rateLimitStore.get(ip);

  if (!userRateLimit) {
    rateLimitStore.set(ip, { count: 1, timestamp: now });
    return false;
  }

  if (now - userRateLimit.timestamp > RATE_LIMIT.WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, timestamp: now });
    return false;
  }

  if (userRateLimit.count >= RATE_LIMIT.MAX_REQUESTS) {
    return true;
  }

  userRateLimit.count++;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Check rate limit
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Validate API key
    const apiKey = request.headers.get('Authorization')?.split(' ')[1];
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    // Validate endpoint URL
    const endpointUrl = process.env.ENDPOINT_URL;
    logger.info(`Endpoint URL: ${endpointUrl}`);
    if (!endpointUrl || (!endpointUrl.startsWith('http:') && !endpointUrl.startsWith('https:'))) {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json() as ChatRequest;
    
    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Format conversation history with proper typing
    const messages: Message[] = [
      ...(body.history || []),
      { role: 'user' as const, content: body.message }
    ];

    // Get streaming response
    const chunks: string[] = [];
    await streamCompletion(
      messages,
      (chunk) => {
        chunks.push(chunk);
      },
      apiKey
    );

    // Combine chunks for final response
    const response = chunks.join('');

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Chat API error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded on Groq API' },
          { status: 429 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Implement OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

