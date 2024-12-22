# Calculator Plugin for Eliza

A basic arithmetic calculator plugin demonstrating the implementation of actions and evaluators in the Eliza AI framework.

## Components

### Action: CALCULATE
Performs basic arithmetic calculations with support for:
- Addition (+)
- Subtraction (-)
- Multiplication (*)
- Division (/)

Example:
```typescript
// User input
"2 + 2"

// Agent response
"The result of 2 + 2 is 4"
```

### Evaluator: CALCULATE_EVALUATOR
Validates calculation results by:
- Checking input format
- Validating numbers
- Verifying operator
- Confirming result accuracy
- Preventing division by zero

Example:
```typescript
// Input to evaluate
"The result of 2 + 2 is 4"
// Response: { success: true, response: "Calculation is valid" }

// Invalid input
"The result of 5 / 0 is undefined"
// Response: { success: false, response: "Division by zero is not allowed" }
```

## Usage

```typescript
import { calculatorPlugin } from '@ai16z/eliza-plugin-calculator';

// Register the plugin
agent.registerPlugin(calculatorPlugin);
```

## Implementation Details

The plugin demonstrates:
1. Proper Action implementation with:
   - Input validation
   - Error handling
   - Type-safe interfaces
   - Example-based interaction patterns

2. Evaluator implementation showing:
   - Result verification
   - Comprehensive error checking
   - Type safety
   - Always-run evaluation

## Error Handling

Handles common errors:
- Invalid expressions
- Division by zero
- Malformed input
- Incorrect results
