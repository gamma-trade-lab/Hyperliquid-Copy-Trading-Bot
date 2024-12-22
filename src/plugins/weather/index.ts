import { Plugin } from "@ai16z/eliza";
import { getWeatherAction } from "./action.ts";
import { weatherEvaluator } from "./evaluator.ts";
import { weatherProvider, initializeWeatherProvider } from "./provider.ts";
import { WeatherConfig } from "./types.ts";

export const weatherPlugin: Plugin = {
  name: "weather",
  description: "Weather information plugin with OpenWeatherMap integration",
  actions: [getWeatherAction],
  evaluators: [weatherEvaluator],
  providers: [weatherProvider],
};

export const initializeWeather = (config: WeatherConfig): void => {
  initializeWeatherProvider(config);
};

export * from "./types.ts";
