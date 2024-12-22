import { Action, Content, IAgentRuntime, Memory, State } from '@ai16z/eliza';

interface CalculateContent extends Content {
  text: string;
}

interface CalculateResponse {
  success: boolean;
  response: string;
}

export const calculateAction: Action = {
  name: 'CALCULATE',
  description: 'Performs basic arithmetic calculations',
  similes: [
    'BASIC_MATH',
    'ARITHMETIC',
    'MATH_OPERATION',
    'NUMBER_CALCULATION',
    'COMPUTE_MATH'
  ],
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: '2 + 2' } as CalculateContent
      },
      {
        user: '{{agentName}}',
        content: {
          text: 'The result of 2 + 2 is 4',
          action: 'CALCULATE'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: '10 - 5' } as CalculateContent
      },
      {
        user: '{{agentName}}',
        content: {
          text: 'The result of 10 - 5 is 5',
          action: 'CALCULATE'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: '3 * 4' } as CalculateContent
      },
      {
        user: '{{agentName}}',
        content: {
          text: 'The result of 3 * 4 is 12',
          action: 'CALCULATE'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: '10 / 2' } as CalculateContent
      },
      {
        user: '{{agentName}}',
        content: {
          text: 'The result of 10 / 2 is 5',
          action: 'CALCULATE'
        }
      }
    ]
  ],
  validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
    try {
      const content = message.content as CalculateContent;
      if (typeof content.text !== 'string') {
        return false;
      }
      const parts = content.text.split(/\s+/);
      return parts.length === 3 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[2]));
    } catch {
      return false;
    }
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<CalculateResponse> => {
    try {
      const content = message.content as CalculateContent;
      const parts = content.text.split(/\s+/);
      const [leftStr, operator, rightStr] = parts;
      const left = parseFloat(leftStr);
      const right = parseFloat(rightStr);

      let result: number;
      switch (operator) {
        case '+': result = left + right; break;
        case '-': result = left - right; break;
        case '*': result = left * right; break;
        case '/':
          if (right === 0) throw new Error('Division by zero');
          result = left / right;
          break;
        default:
          throw new Error('Invalid operator');
      }

      return {
        success: true,
        response: `${content.text} = ${result}`
      };
    } catch (error) {
      return {
        success: false,
        response: error instanceof Error ? error.message : 'Calculation failed'
      };
    }
  }
};
