import { agentKit } from "@/utils/solanaAgent.js";
import { solanaAgentState } from "@/utils/state.js";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";

import {
  SolanaBalanceTool,
  SolanaFetchPriceTool,
} from "solana-agent-kit/dist/langchain";

const groq = new ChatGroq({ apiKey: process.env.GROQ_API_KEY! });

const readAgent = createReactAgent({
  llm: groq,
  tools: [new SolanaBalanceTool(agentKit), new SolanaFetchPriceTool(agentKit)],
});

export const readNode = async (state: typeof solanaAgentState.State) => {
  const { messages } = state;

  const result = await readAgent.invoke({ messages });

  return { messages: [...result.messages] };
};
