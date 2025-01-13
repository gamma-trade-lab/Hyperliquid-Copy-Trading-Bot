export class BaseError extends Error {
    code;
    isOperational;
    constructor(message, code, isOperational = true) {
        super(message);
        this.code = code;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ValidationError extends BaseError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR');
    }
}
export class NetworkError extends BaseError {
    constructor(message) {
        super(message, 'NETWORK_ERROR');
    }
}
export class TransactionError extends BaseError {
    signature;
    logs;
    constructor(message, signature, logs) {
        super(message, 'TRANSACTION_ERROR');
        this.signature = signature;
        this.logs = logs;
    }
}
export class InsufficientFundsError extends BaseError {
    constructor(message) {
        super(message, 'INSUFFICIENT_FUNDS');
    }
}
export class QuoteError extends BaseError {
    constructor(message) {
        super(message, 'QUOTE_ERROR');
    }
}
export class RateLimitError extends BaseError {
    constructor(message) {
        super(message, 'RATE_LIMIT_ERROR');
    }
}
export class ConfigurationError extends BaseError {
    constructor(message) {
        super(message, 'CONFIGURATION_ERROR', false);
    }
}
export class ApiError extends BaseError {
    status;
    response;
    constructor(message, status, response) {
        super(message, 'API_ERROR');
        this.status = status;
        this.response = response;
    }
}
export class ErrorHandler {
    static instance;
    errorMap = new Map();
    maxErrorsPerType = 100;
    constructor() { }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    handle(error, context) {
        const metadata = this.createErrorMetadata(error, context);
        this.storeError(metadata);
        return metadata;
    }
    createErrorMetadata(error, context) {
        const isBaseError = error instanceof BaseError;
        return {
            code: isBaseError ? error.code : 'UNKNOWN_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
            isOperational: isBaseError ? error.isOperational : false,
            stack: error.stack,
            context
        };
    }
    storeError(metadata) {
        const errors = this.errorMap.get(metadata.code) || [];
        errors.push(metadata);
        // Keep only the most recent errors
        if (errors.length > this.maxErrorsPerType) {
            errors.shift();
        }
        this.errorMap.set(metadata.code, errors);
    }
    getErrors(code, limit = 10) {
        if (code) {
            const errors = this.errorMap.get(code) || [];
            return errors.slice(-limit);
        }
        // Get recent errors of all types
        const allErrors = Array.from(this.errorMap.values())
            .flat()
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return allErrors.slice(0, limit);
    }
    clearErrors(code) {
        if (code) {
            this.errorMap.delete(code);
        }
        else {
            this.errorMap.clear();
        }
    }
    isOperationalError(error) {
        if (error instanceof BaseError) {
            return error.isOperational;
        }
        return false;
    }
}
// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
// Error processing utilities
export function processApiError(error) {
    if (error.response) {
        return new ApiError(error.response.data?.message || error.message, error.response.status, error.response.data);
    }
    return new ApiError(error.message);
}
export function processTransactionError(error, signature) {
    let message = error.message;
    let logs;
    if (error.logs) {
        logs = error.logs;
        message = error.logs[error.logs.length - 1] || message;
    }
    return new TransactionError(message, signature, logs);
}
// Error checking utilities
export function isInsufficientFundsError(error) {
    return (error instanceof InsufficientFundsError ||
        error.message.includes('insufficient funds') ||
        error.message.includes('0x1') // Solana insufficient funds error code
    );
}
export function isTransactionError(error) {
    return (error instanceof TransactionError ||
        error.message.includes('Transaction failed') ||
        error.message.includes('0x0') // Solana transaction error code
    );
}
export function isQuoteError(error) {
    return (error instanceof QuoteError ||
        error.message.includes('quote failed') ||
        error.message.includes('No route found'));
}
export function isRateLimitError(error) {
    return (error instanceof RateLimitError ||
        error.message.includes('rate limit') ||
        error.message.includes('429') // HTTP rate limit status code
    );
}
