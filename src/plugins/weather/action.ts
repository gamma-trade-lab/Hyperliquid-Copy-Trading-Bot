import { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { WeatherActionContent, WeatherData } from "./types.ts";
import { weatherProvider } from "./provider.ts";

export const getWeatherAction: Action = {
  name: "GET_WEATHER",
  description: "Retrieves weather information for a specified location",
  similes: [
    "WEATHER_CHECKER",
    "CLIMATE_INFO",
    "TEMPERATURE_LOOKUP",
    "WEATHER_QUERY",
  ],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "What's the weather in London?",
        } as WeatherActionContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "The current weather in London is cloudy with a temperature of 15°C, 75% humidity, and wind speed of 10 km/h",
          action: "GET_WEATHER",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "How's the weather in New York?",
        } as WeatherActionContent,
      },
      {
        user: "{{agentName}}",
        content: {
          text: "The current weather in New York is sunny with a temperature of 25°C, 60% humidity, and wind speed of 15 km/h",
          action: "GET_WEATHER",
        },
      },
    ],
  ],

  validate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<boolean> => {
    try {
      const content = message.content as WeatherActionContent;
      return (
        typeof content.text === "string" &&
        content.text.toLowerCase().includes("weather")
      );
    } catch {
      return false;
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
  ): Promise<string> => {
    try {
      const response = await weatherProvider.get(runtime, message, state);

      if (!response.success || !response.data) {
        return `Sorry, I couldn't get the weather information. ${response.error || ""}`;
      }

      const data: WeatherData = response.data;
      const tempUnit = data.units === "metric" ? "°C" : "°F";
      const speedUnit = data.units === "metric" ? "km/h" : "mph";

      return `The current weather in ${data.location} is ${data.description} with a temperature of ${data.temperature}${tempUnit}, ${data.humidity}% humidity, and wind speed of ${data.windSpeed} ${speedUnit}`;
    } catch (error) {
      return `Sorry, there was an error processing your weather request: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
};
