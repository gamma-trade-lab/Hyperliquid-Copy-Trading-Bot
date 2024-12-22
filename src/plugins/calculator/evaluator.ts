import {
  Content,
  Evaluator,
  EvaluationExample,
  IAgentRuntime,
  Memory,
  State,
} from "@ai16z/eliza";

interface CalculateEvalContent extends Content {
  text: string;
}

interface CalculateEvalResponse {
  success: boolean;
  response: string;
}

export const calculateEvaluator: Evaluator = {
  name: "CALCULATE_EVALUATOR",
  description: "Evaluates arithmetic calculation results",
  similes: [
    "CALCULATOR_EVALUATOR",
    "CALCULATION_VALIDATOR",
    "ARITHMETIC_VERIFIER",
    "RESULT_VALIDATOR",
    "COMPUTATION_CHECKER",
  ],
  examples: [
    {
      context: "Evaluating basic addition",
      messages: [
        {
          user: "{{user1}}",
          content: { text: "The result of 2 + 2 is 4" },
        },
      ],
      outcome: "Calculation is valid",
    },
    {
      context: "Handling division by zero",
      messages: [
        {
          user: "{{user1}}",
          content: { text: "The result of 5 / 0 is undefined" },
        },
      ],
      outcome: "Division by zero is not allowed",
    },
    {
      context: "Evaluating multiplication",
      messages: [
        {
          user: "{{user1}}",
          content: { text: "The result of 10 * 5 is 50" },
        },
      ],
      outcome: "Calculation is valid",
    },
  ],
  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    try {
      const content = message.content as CalculateEvalContent;
      return typeof content.text === "string";
    } catch {
      return false;
    }
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<CalculateEvalResponse> => {
    try {
      const content = message.content as CalculateEvalContent;
      const [expression, result] = content.text.split("=").map((s) => s.trim());

      // Parse expression
      const parts = expression.split(/\s+/);
      if (parts.length !== 3) {
        return {
          success: false,
          response: "Invalid expression format",
        };
      }

      const [leftStr, operator, rightStr] = parts;
      const left = parseFloat(leftStr);
      const right = parseFloat(rightStr);

      // Validate numbers
      if (isNaN(left) || isNaN(right)) {
        return {
          success: false,
          response: "Invalid numbers in expression",
        };
      }

      // Check division by zero
      if (operator === "/" && right === 0) {
        return {
          success: false,
          response: "Division by zero is not allowed",
        };
      }

      // Verify result matches calculation
      let expectedResult: number;
      switch (operator) {
        case "+":
          expectedResult = left + right;
          break;
        case "-":
          expectedResult = left - right;
          break;
        case "*":
          expectedResult = left * right;
          break;
        case "/":
          expectedResult = left / right;
          break;
        default:
          return {
            success: false,
            response: "Invalid operator",
          };
      }

      const actualResult = parseFloat(result);
      if (
        isNaN(actualResult) ||
        Math.abs(actualResult - expectedResult) > 0.0001
      ) {
        return {
          success: false,
          response: "Calculation result is incorrect",
        };
      }
      return {
        success: true,
        response: "Calculation is valid",
      };
    } catch (error) {
      return {
        success: false,
        response: error instanceof Error ? error.message : "Evaluation failed",
      };
    }
  },
  alwaysRun: true,
} as Evaluator;
