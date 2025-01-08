import { Evaluator, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { WeatherEvalContent, WeatherEvalResponse } from "./types.js";

export const weatherEvaluator: Evaluator = {
  name: "WEATHER_EVALUATOR",
  description: "Validates weather information responses",
  similes: [
    "WEATHER_CHECKER",
    "CLIMATE_VALIDATOR",
    "TEMPERATURE_VERIFIER",
    "WEATHER_RESPONSE_VALIDATOR",
  ],
  examples: [
    {
      context: "Validating complete weather response",
      messages: [
        {
          user: "{{user1}}",
          content: {
            text: "The current weather in London is cloudy with a temperature of 15°C, 75% humidity, and wind speed of 10 km/h",
          },
        },
      ],
      outcome: "Weather information is valid",
    },
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    try {
      const content = message.content as WeatherEvalContent;
      return typeof content.text === "string";
    } catch {
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<WeatherEvalResponse> => {
    try {
      const content = message.content as WeatherEvalContent;
      const text = content.text.toLowerCase();

      // Check for required components
      if (!text.includes("weather in")) {
        return {
          success: false,
          response: "Missing location information",
        };
      }

      if (!text.includes("temperature")) {
        return {
          success: false,
          response: "Missing temperature information",
        };
      }

      // Validate temperature format
      const tempMatch = text.match(/temperature of (-?\d+(?:\.\d+)?)[°℃℉]/);
      if (!tempMatch) {
        return {
          success: false,
          response: "Invalid temperature format",
        };
      }

      // Validate temperature range (-100 to 60°C or -148 to 140°F)
      const temp = parseFloat(tempMatch[1]);
      const isMetric = text.includes("°c") || text.includes("℃");
      if (isMetric && (temp < -100 || temp > 60)) {
        return {
          success: false,
          response: "Temperature out of valid range for Celsius",
        };
      } else if (!isMetric && (temp < -148 || temp > 140)) {
        return {
          success: false,
          response: "Temperature out of valid range for Fahrenheit",
        };
      }

      return {
        success: true,
        response: "Weather information is valid",
      };
    } catch (error) {
      return {
        success: false,
        response:
          error instanceof Error
            ? error.message
            : "Failed to validate weather information",
      };
    }
  },

  alwaysRun: true,
};
