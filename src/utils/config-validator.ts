import {logger} from './logger';

interface ValidationError {
    path: string[];
    message: string;
}

export function validateConfig(config: any): void {
    const errors: ValidationError[] = [];

    // Helper function to check nested properties
    function validateNestedProperty(obj: any, path: string[]) {
        if (!obj) {
            errors.push({
                path,
                message: `${path.join('.')} configuration is missing`
            });
            return;
        }

        // Validate SOLANA config
        if (path[0] === 'SOLANA') {
            if (!obj.NETWORK) {
                errors.push({
                    path: [...path, 'NETWORK'],
                    message: 'SOLANA.NETWORK is missing'
                });
            }
            if (!obj.RPC_URL) {
                errors.push({
                    path: [...path, 'RPC_URL'],
                    message: 'SOLANA.RPC_URL is missing'
                });
            }
            if (!obj.PUBLIC_KEY) {
                errors.push({
                    path: [...path, 'PUBLIC_KEY'],
                    message: 'SOLANA.PUBLIC_KEY is missing'
                });
            }
            return;
        }

        // Validate AI config
        if (path[0] === 'AI') {
            if (!obj.GROQ?.MODEL) {
                errors.push({
                    path: [...path, 'GROQ', 'MODEL'],
                    message: 'AI.GROQ.MODEL is missing'
                });
            }
            return;
        }

        // Validate AUTOMATION config
        if (path[0] === 'AUTOMATION') {
            const requiredIntervals = [
                'CONTENT_GENERATION_INTERVAL',
                'MARKET_MONITORING_INTERVAL',
                'COMMUNITY_ENGAGEMENT_INTERVAL',
                'TWEET_INTERVAL'
            ];

            requiredIntervals.forEach(interval => {
                if (typeof obj[interval] !== 'number' || obj[interval] <= 0) {
                    errors.push({
                        path: [...path, interval],
                        message: `${path.join('.')}.${interval} must be a positive number`
                    });
                }
            });
            return;
        }
    }

    // Validate top-level sections
    ['SOLANA', 'AI', 'AUTOMATION'].forEach(section => {
        validateNestedProperty(config[section], [section]);
    });

    // If any validation errors occurred, log them and throw
    if (errors.length > 0) {
        errors.forEach(error => {
            logger.error(`Config validation error: ${error.message}`);
        });

        throw new Error(
            `Configuration validation failed:\n${errors
                .map(e => `- ${e.message}`)
                .join('\n')}`
        );
    }

    logger.info('Configuration validation successful');
}