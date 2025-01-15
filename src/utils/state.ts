import { BaseMessage } from "@langchain/core/messages.js";
import { RunnableConfig } from "@langchain/core/runnables.js";

export interface SolanaAgentState {
  messages: BaseMessage[];
  config?: RunnableConfig;
  isSolanaReadQuery?: boolean;
  isSolanaWriteQuery?: boolean;
  isGeneralQuery?: boolean;
  channels?: any[];
}

// Create initial state
export const createInitialState = (): SolanaAgentState => ({
  messages: [],
  channels: [],
});

// State management functions
export const solanaAgentState = {
  State: {} as SolanaAgentState,

  // Update messages
  updateMessages: (state: SolanaAgentState, newMessages: BaseMessage[]): SolanaAgentState => ({
    ...state,
    messages: [...state.messages, ...newMessages],
  }),

  // Clear messages
  clearMessages: (state: SolanaAgentState): SolanaAgentState => ({
    ...state,
    messages: [],
  }),

  // Get current state
  getCurrentState: (): SolanaAgentState => solanaAgentState.State,
};