import {
  Evaluator,
  ActionExample,
  Content,
  IAgentRuntime,
  Memory,
} from "@ai16z/eliza";

interface WeatherEvalContent extends Content {
  text: string;
  weatherData?: {
    temperature: number;
    conditions: string;
    location: string;
    timestamp: number;
  };
}

interface WeatherEvalResponse {
  isValid: boolean;
  reason: string;
  recommendations?: string[];
}

export const weatherEvaluator: Evaluator = {
  name: "VALIDATE_WEATHER_RESPONSE",

  similes: [
    "CHECK_WEATHER_DATA",
    "VERIFY_WEATHER_INFO",
    "WEATHER_ACCURACY_CHECK",
  ],

  description:
    "Validates weather responses for accuracy, freshness, and provides relevant recommendations based on conditions",

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<boolean> => {
    const content = message.content as WeatherEvalContent;
    return (
      content.weatherData !== undefined ||
      /weather|temperature|forecast|humidity|precipitation/i.test(content.text)
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
  ): Promise<WeatherEvalResponse> => {
    const content = message.content as WeatherEvalContent;

    // If we have structured weather data from an action
    if (content.weatherData) {
      const { temperature, conditions, timestamp } = content.weatherData;

      // Check data freshness (within last hour)
      if (Date.now() - timestamp > 3600000) {
        return {
          isValid: false,
          reason: "Weather data is stale",
        };
      }

      // Generate condition-based recommendations
      const recommendations = [];
      if (temperature > 30) {
        recommendations.push(
          "High temperature alert - suggest indoor activities",
        );
      }
      if (conditions.toLowerCase().includes("rain")) {
        recommendations.push("Rain detected - recommend umbrella");
      }

      return {
        isValid: true,
        reason: "Weather data validated",
        recommendations,
      };
    }

    // For text-based responses from provider
    return {
      isValid: true,
      reason: "Weather information provided",
      recommendations: [],
    };
  },

  examples: [
    {
      context: "{{user1}} requests current weather",
      messages: [
        {
          user: "{{user1}}",
          content: {
            text: "What's the weather like in New York?",
            action: "GET_WEATHER",
          },
        },
        {
          user: "WeatherBot",
          content: {
            text: "Current weather in New York: 25°C, Partly Cloudy",
            weatherData: {
              temperature: 25,
              conditions: "Partly Cloudy",
              location: "New York",
              timestamp: Date.now(),
            },
          },
        },
      ],
      outcome: `{
                "isValid": true,
                "reason": "Weather data validated",
                "recommendations": []
            }`,
    },
    {
      context: "{{user1}} receives stale weather data",
      messages: [
        {
          user: "WeatherBot",
          content: {
            text: "Weather in Miami: 32°C, Sunny",
            weatherData: {
              temperature: 32,
              conditions: "Sunny",
              location: "Miami",
              timestamp: Date.now() - 5000000,
            },
          },
        },
      ],
      outcome: `{
                "isValid": false,
                "reason": "Weather data is stale"
            }`,
    },
  ],

  alwaysRun: true,
};
