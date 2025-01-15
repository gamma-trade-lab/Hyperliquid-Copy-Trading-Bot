import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { getModel } from "@/utils/model.js";
import { SolanaAgentState, solanaAgentState } from "@/utils/state.js";
import { Tool } from "@langchain/core/tools";
import { elizaLogger } from "@ai16z/eliza";

// Initialize tools with proper typing
const initializeTools = (): Tool[] => {
  const tools: Tool[] = [];

  if (process.env.TAVILY_API_KEY) {
    try {
      tools.push(new TavilySearchResults());
      elizaLogger.success('Tavily search tool initialized');
    } catch (error) {
      elizaLogger.error('Failed to initialize Tavily search:', error);
    }
  }

  return tools;
};

// Create the general agent with proper typing
const generalAgent = createReactAgent({
  llm: getModel('groq'),
  tools: initializeTools(),
});

// Export the generalist node function
export const generalistNode = async (state: SolanaAgentState) => {
  try {
    const { messages } = state;
    const result = await generalAgent.invoke({ messages });
    
    return { 
      messages: result.messages 
    };
  } catch (error) {
    elizaLogger.error('Error in generalist node:', error);
    throw error;
  }
};