export class ApiError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ApiError";
    }
}
export const validateApiKey = (config) => {
    if (!config.apiKey) {
        throw new ApiError("API key is required");
    }
};
export const validateSearchQuery = (content) => {
    const query = typeof content === "string" ? content : content.text;
    if (!query?.trim()) {
        throw new ApiError("Search query is required");
    }
    return query.trim();
};
export const handleApiError = (error) => {
    if (error instanceof ApiError) {
        return {
            success: false,
            response: `API Error: ${error.message}`,
        };
    }
    return {
        success: false,
        response: "An unexpected error occurred",
    };
};
export const formatSearchResults = (results) => {
    return results
        .map((result, index) => {
        return `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.snippet}\n`;
    })
        .join("\n");
};
export const createRateLimiter = (maxRequests, timeWindow) => {
    const requests = [];
    return {
        checkLimit: () => {
            const now = Date.now();
            const windowStart = now - timeWindow;
            // Remove old requests
            while (requests.length > 0 && requests[0] < windowStart) {
                requests.shift();
            }
            // Check if we're at the limit
            if (requests.length >= maxRequests) {
                return false;
            }
            // Add new request
            requests.push(now);
            return true;
        },
    };
};
