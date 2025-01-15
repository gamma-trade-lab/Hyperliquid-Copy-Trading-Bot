import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SolanaTransferTool } from "solana-agent-kit/dist/langchain";
import { transferSwapPrompt } from "../prompts/transferSwap.js";
import { swapTool } from "../tools/swap.js";

import { agentKit } from "@/utils/solanaAgent.js";
import { solanaAgentState } from "@/utils/state.js";
import { ChatGroq } from "@langchain/groq";

const groq = new ChatGroq({ apiKey: process.env.GROQ_API_KEY! });

const transferOrSwapAgent = createReactAgent({
  stateModifier: transferSwapPrompt,
  llm: groq,
  tools: [new SolanaTransferTool(agentKit), swapTool],
});

export const transferSwapNode = async (
  state: typeof solanaAgentState.State,
) => {
  const { messages } = state;

  const result = await transferOrSwapAgent.invoke({
    messages,
  });

  return result;
};
