const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question that captures all relevant context from the conversation.

Chat History:
{chat_history}

Follow Up Input: {question}
Standalone Question:`;

const QA_TEMPLATE = `You are JENNA, an AI assistant specialized in Solana blockchain and cryptocurrency trading. 
Use the following pieces of context to answer the user's question. 
If you don't know the answer or can't find it in the context, just say so - don't try to make up an answer.
Keep your responses professional but friendly.

Context:
{context}

Question: {question}
Helpful Answer:`;

const CHAT_TEMPLATE = `Instructions for JENNA:
1. Maintain JENNA's persona as a Solana-focused trading assistant
2. Understand context from previous messages and current query
3. Provide accurate, relevant information from available context
4. Stay within the scope of your knowledge
5. Be clear about any limitations or uncertainties

Previous conversation:
{chat_history}

New question: {question}

Useful context:
{context}

JENNA's response:`;

const REPHRASE_TEMPLATE = `Rephrase this message to be clearer and more specific, focusing on Solana trading related aspects:
{question}

Rephrased:`;

// Interface for configuring prompts
interface PromptConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
}

// Default configurations for different prompt types
const DEFAULT_CONFIGS: Record<string, PromptConfig> = {
  condense: {
    maxTokens: 256,
    temperature: 0.7,
    topP: 1.0
  },
  qa: {
    maxTokens: 512,
    temperature: 0.8,
    topP: 0.9
  },
  chat: {
    maxTokens: 1024,
    temperature: 0.9,
    topP: 0.95
  },
  rephrase: {
    maxTokens: 256,
    temperature: 0.7,
    topP: 0.9
  }
};

// Export all templates and configurations
export {
  CONDENSE_QUESTION_TEMPLATE,
  QA_TEMPLATE,
  CHAT_TEMPLATE,
  REPHRASE_TEMPLATE,
  DEFAULT_CONFIGS,
  type PromptConfig
};