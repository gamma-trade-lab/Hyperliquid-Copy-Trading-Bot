import { deepseekPrompt } from '../prompts/deepseek.prompt';

export const marketAnalysisGroup = {
  name: 'Market Analysis Group',
  description: 'A group of agents specialized in market analysis and trading decisions',
  
  agents: [
    {
      id: 'deepseek-analyst',
      name: 'DeepSeek Market Analyst',
      model: 'deepseek-coder-33b-instruct',
      prompt: deepseekPrompt,
      role: 'ANALYST',
      priority: 1,
      maxConcurrentTasks: 3,
      timeoutMs: 30000
    }
    // Add more agents as needed
  ],

  workflow: {
    stages: [
      {
        name: 'Initial Analysis',
        agents: ['deepseek-analyst'],
        requiredConfidence: 0.8,
        timeoutMs: 60000
      }
      // Add more stages as needed
    ],
    
    fallbackBehavior: {
      retryCount: 3,
      backoffMs: 1000,
      escalationThreshold: 0.6
    }
  },

  coordination: {
    consensusThreshold: 0.7,
    votingEnabled: true,
    requireUnanimity: false
  }
}; 