import { END } from "@langchain/langgraph";
import { solanaAgentState } from "./state.js";

export const managerRouter = (state: typeof solanaAgentState.State) => {
  const { isSolanaReadQuery, isSolanaWriteQuery, isGeneralQuery } = state;

  if (isGeneralQuery) {
    return "generalist";
  } else if (isSolanaWriteQuery) {
    return "transferSwap";
  } else if (isSolanaReadQuery) {
    return "read";
  } else {
    return END;
  }
};
