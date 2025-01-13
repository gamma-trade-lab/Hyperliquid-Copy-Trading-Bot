export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
export const retry = async (fn, maxRetries = 5, delay = 1000) => {
    let lastError = new Error('Unknown error occurred');
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxRetries)
                break;
            await sleep(delay * attempt); // Exponential backoff
        }
    }
    throw lastError;
};
