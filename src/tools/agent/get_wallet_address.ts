import { SolanaAgentKit } from "solana-agent-kit";


/**
 * Get the agents wallet address
 * @param agent - SolanaAgentKit instance
 * @returns string
 */
export function get_wallet_address(agent: SolanaAgentKit) {
  return agent.wallet_address.toBase58();
}
