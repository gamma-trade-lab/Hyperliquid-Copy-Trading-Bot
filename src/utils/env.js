import dotenv from 'dotenv';
import { TwitterAuthError } from '../types/errors.js';
// Load environment variables from .env file
dotenv.config();
export function getTwitterCredentials() {
    const username = process.env.twitter_username;
    const password = process.env.twitter_password;
    const email = process.env.twitter_email;
    if (!username || !password || !email) {
        throw new TwitterAuthError('Missing Twitter credentials. Please ensure twitter_username, twitter_password, and twitter_email are set in .env file.');
    }
    return {
        username,
        password,
        email
    };
}
export function validateEnvironment() {
    // Validate all required environment variables are present
    const requiredVars = [
        'twitter_username',
        'twitter_password',
        'twitter_email'
    ];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}
