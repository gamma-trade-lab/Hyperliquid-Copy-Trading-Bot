export class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class NetworkError extends BaseError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
  }
}

export class TransactionError extends BaseError {
  constructor(
    message: string,
    public readonly signature?: string,
    public readonly logs?: string[]
  ) {
    super(message, 'TRANSACTION_ERROR');
  }
}

export class InsufficientFundsError extends BaseError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_FUNDS');
  }
}

export class QuoteError extends BaseError {
  constructor(message: string) {
    super(message, 'QUOTE_ERROR');
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_ERROR');
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', false);
  }
}

export class ApiError extends BaseError {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly response?: any
  ) {
    super(message, 'API_ERROR');
  }
}

interface ErrorMetadata {
  code: string;
  message: string;
  timestamp: string;
  isOperational: boolean;
  stack?: string;
  context?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly errorMap: Map<string, ErrorMetadata[]> = new Map();
  private readonly maxErrorsPerType = 100;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  handle(error: Error, context?: Record<string, any>): ErrorMetadata {
    const metadata = this.createErrorMetadata(error, context);
    this.storeError(metadata);
    return metadata;
  }

  private createErrorMetadata(
    error: Error,
    context?: Record<string, any>
  ): ErrorMetadata {
    const isBaseError = error instanceof BaseError;
    
    return {
      code: isBaseError ? (error as BaseError).code : 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      isOperational: isBaseError ? (error as BaseError).isOperational : false,
      stack: error.stack,
      context
    };
  }

  private storeError(metadata: ErrorMetadata) {
    const errors = this.errorMap.get(metadata.code) || [];
    errors.push(metadata);
    
    // Keep only the most recent errors
    if (errors.length > this.maxErrorsPerType) {
      errors.shift();
    }
    
    this.errorMap.set(metadata.code, errors);
  }

  getErrors(
    code?: string,
    limit = 10
  ): ErrorMetadata[] {
    if (code) {
      const errors = this.errorMap.get(code) || [];
      return errors.slice(-limit);
    }

    // Get recent errors of all types
    const allErrors = Array.from(this.errorMap.values())
      .flat()
      .sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    
    return allErrors.slice(0, limit);
  }

  clearErrors(code?: string) {
    if (code) {
      this.errorMap.delete(code);
    } else {
      this.errorMap.clear();
    }
  }

  isOperationalError(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational;
    }
    return false;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Error processing utilities
export function processApiError(error: any): ApiError {
  if (error.response) {
    return new ApiError(
      error.response.data?.message || error.message,
      error.response.status,
      error.response.data
    );
  }
  return new ApiError(error.message);
}

export function processTransactionError(
  error: any,
  signature?: string
): TransactionError {
  let message = error.message;
  let logs: string[] | undefined;

  if (error.logs) {
    logs = error.logs;
    message = error.logs[error.logs.length - 1] || message;
  }

  return new TransactionError(message, signature, logs);
}

// Error checking utilities
export function isInsufficientFundsError(error: Error): boolean {
  return (
    error instanceof InsufficientFundsError ||
    error.message.includes('insufficient funds') ||
    error.message.includes('0x1') // Solana insufficient funds error code
  );
}

export function isTransactionError(error: Error): boolean {
  return (
    error instanceof TransactionError ||
    error.message.includes('Transaction failed') ||
    error.message.includes('0x0') // Solana transaction error code
  );
}

export function isQuoteError(error: Error): boolean {
  return (
    error instanceof QuoteError ||
    error.message.includes('quote failed') ||
    error.message.includes('No route found')
  );
}

export function isRateLimitError(error: Error): boolean {
  return (
    error instanceof RateLimitError ||
    error.message.includes('rate limit') ||
    error.message.includes('429') // HTTP rate limit status code
  );
} 