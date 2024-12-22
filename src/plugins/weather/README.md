# Weather Plugin for Eliza

A weather information plugin demonstrating the implementation of actions, evaluators, and providers in the Eliza AI framework.

## Components

### Action: GET_WEATHER
Retrieves weather information for a specified location with support for:
- Current weather conditions
- Temperature
- Humidity
- Wind speed
- Weather description

Example:
```typescript
// User input
"What's the weather in London?"

// Agent response
"The current weather in London is cloudy with a temperature of 15°C, 75% humidity, and wind speed of 10 km/h"
```

### Evaluator: WEATHER_EVALUATOR
Validates weather responses by:
- Checking location validity
- Verifying data completeness
- Ensuring response format
- Validating temperature ranges
- Confirming measurement units

Example:
```typescript
// Input to evaluate
"The current weather in London is cloudy with a temperature of 15°C"
// Response: { success: true, response: "Weather information is valid" }

// Invalid input
"The weather is nice"
// Response: { success: false, response: "Missing location information" }
```

### Provider: WEATHER_PROVIDER
Integrates with OpenWeatherMap API to:
- Fetch real-time weather data
- Handle API authentication
- Process weather responses
- Format data for actions
- Cache frequent requests

Example:
```typescript
// Provider configuration
{
  apiKey: "your-api-key",
  baseUrl: "https://api.openweathermap.org/data/2.5",
  units: "metric"
}
```

## Usage

```typescript
import { weatherPlugin } from '@ai16z/eliza-plugin-weather';

// Configure the plugin
const config = {
  provider: {
    apiKey: process.env.OPENWEATHER_API_KEY,
    units: 'metric'
  }
};

// Register the plugin
agent.registerPlugin(weatherPlugin, config);
```

## Implementation Details

The plugin demonstrates:
1. Action implementation with:
   - Location parsing
   - Query formatting
   - Response structuring
   - Error handling
   - Type-safe interfaces

2. Evaluator implementation showing:
   - Data validation
   - Format verification
   - Unit checking
   - Response evaluation
   - Type safety

3. Provider implementation featuring:
   - API integration
   - Authentication handling
   - Response caching
   - Error management
   - Type-safe data fetching

## Error Handling

Handles common errors:
- Invalid locations
- API failures
- Missing data
- Invalid units
- Rate limiting
- Network issues
