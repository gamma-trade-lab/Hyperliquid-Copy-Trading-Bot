import { prompt, parser } from "../prompts/manager.js";
import { RunnableSequence } from "@langchain/core/runnables";
import { SolanaAgentState, solanaAgentState } from "../utils/state.js";
import { getModel } from "../utils/model.js";
import { elizaLogger } from "@ai16z/eliza";

// Define interface for query results
interface QueryAnalysisResult {
  isSolanaReadQuery: boolean;
  isSolanaWriteQuery: boolean;
  isGeneralQuery: boolean;
  confidence: number;
  details?: string;
}

// Create chain with Groq model
const chain = RunnableSequence.from([
  prompt,
  getModel('groq'),
  parser
]);

// Manager node implementation
export const managerNode = async (state: SolanaAgentState): Promise<QueryAnalysisResult> => {
  try {
    elizaLogger.info('Processing query in manager node');
    
    const { messages } = state;

    // Invoke chain with proper error handling
    const result = await chain.invoke({
      formatInstructions: parser.getFormatInstructions(),
      messages: messages,
    });

    // Extract and validate results
    const {
      isSolanaReadQuery = false,
      isSolanaWriteQuery = false,
      isGeneralQuery = true,
      
    } = result;

    // Log analysis results
    elizaLogger.info('Query analysis complete', {
      read: isSolanaReadQuery,
      write: isSolanaWriteQuery,
      general: isGeneralQuery,
      
    });

    return {
      isSolanaReadQuery,
      isSolanaWriteQuery,
      isGeneralQuery,
      confidence: 1, // Adding required confidence value for successful queries
    };

  } catch (error) {
    elizaLogger.error('Error in manager node:', error);
    
    // Return safe default values on error
    return {
      isSolanaReadQuery: false,
      isSolanaWriteQuery: false,
      isGeneralQuery: true,
      confidence: 0,
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Export validator function for results
export const validateQueryResult = (result: QueryAnalysisResult): boolean => {
  return (
    typeof result.isSolanaReadQuery === 'boolean' &&
    typeof result.isSolanaWriteQuery === 'boolean' &&
    typeof result.isGeneralQuery === 'boolean' &&
    typeof result.confidence === 'number' &&
    result.confidence >= 0 &&
    result.confidence <= 1
  );
};