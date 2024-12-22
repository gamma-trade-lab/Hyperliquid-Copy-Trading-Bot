import { Content } from '@ai16z/eliza';

export interface WeatherConfig {
  provider: {
    apiKey: string;
    units?: 'metric' | 'imperial';
    baseUrl?: string;
  };
}

export interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  description: string;
  units: 'metric' | 'imperial';
}

export interface WeatherActionContent extends Content {
  text: string;
}

export interface WeatherEvalContent extends Content {
  text: string;
}

export interface WeatherEvalResponse {
  success: boolean;
  response: string;
}

export interface WeatherProviderResponse {
  success: boolean;
  data?: WeatherData;
  error?: string;
}
