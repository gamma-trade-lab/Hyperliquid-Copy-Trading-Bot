import { Groq } from 'groq-sdk';
import { elizaLogger } from "@ai16z/eliza";

interface DocumentChunk {
  content: string;
  metadata?: Record<string, any>;
}

interface RetrievalResult {
  content: string;
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

interface RetrievalOptions {
  maxChunks?: number;
  minRelevance?: number;
  includeSources?: boolean;
} 

/**
 * Process documents for retrieval
 */
export async function processDocuments(
  documents: DocumentChunk[],
  options: RetrievalOptions = {}
): Promise<RetrievalResult[]> {
  try {
    const {
      maxChunks = 5,
      minRelevance = 0.7,
      includeSources = false
    } = options;

    const results: RetrievalResult[] = documents.map(doc => ({
      content: doc.content,
      metadata: includeSources ? doc.metadata : undefined
    }));

    // Sort by relevance (if available)
    results.sort((a, b) => 
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    // Filter by minimum relevance
    const filteredResults = results.filter(
      result => (result.relevanceScore || 0) >= minRelevance
    );

    // Limit number of chunks
    return filteredResults.slice(0, maxChunks);
  } catch (error) {
    elizaLogger.error('Error processing documents:', error);
    throw error;
  }
}

/**
 * Format retrieval results for prompts
 */
export function formatRetrievalResults(
  results: RetrievalResult[],
  maxLength: number = 2000
): string {
  try {
    let formattedText = results
      .map((result, index) => {
        let chunk = `[${index + 1}] ${result.content}`;
        if (result.metadata?.source) {
          chunk += `\nSource: ${result.metadata.source}`;
        }
        return chunk;
      })
      .join('\n\n');

    // Trim if too long
    if (formattedText.length > maxLength) {
      formattedText = formattedText.slice(0, maxLength) + '...';
    }

    return formattedText;
  } catch (error) {
    elizaLogger.error('Error formatting retrieval results:', error);
    return 'Error formatting context';
  }
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(
  text: string,
  groq: Groq
): Promise<number[]> {
  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: text }],
      model: 'mixtral-8x7b-32768'
    });

    // Extract embedding from response
    const embedding = response.choices[0]?.message?.content || '';
    
    // Convert embedding string to number array
    // Note: Implementation depends on how Groq returns embeddings
    return embedding.split(',').map(Number);
  } catch (error) {
    elizaLogger.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate similarity between embeddings
 */
export function calculateSimilarity(
  embedding1: number[],
  embedding2: number[]
): number {
  try {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions do not match');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  } catch (error) {
    elizaLogger.error('Error calculating similarity:', error);
    return 0;
  }
}

// Export types
export type {
  DocumentChunk,
  RetrievalResult,
  RetrievalOptions
};