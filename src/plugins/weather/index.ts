import { Plugin } from "@ai16z/eliza";
import { getWeatherAction } from "./action.js";
import { weatherEvaluator } from "./evaluator.js";
import { weatherProvider, initializeWeatherProvider } from "./provider.js";
import { WeatherConfig } from "./types.js";

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

export * from "./types.js";
