export default {
    // Add configuration values from .env
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }
};
