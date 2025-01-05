import { CookieJar } from 'tough-cookie';
import fetch from 'node-fetch';
import { TwitterAuthError } from '../../../types/errors';
import { getTwitterCredentials } from '../../../utils/env';

interface TwitterAuthConfig {
  username: string;
  password: string;
  email: string;
}

export class TwitterCookieAuth {
  private jar: CookieJar;
  private authenticated: boolean;
  private readonly config: TwitterAuthConfig;

  constructor() {
    this.jar = new CookieJar();
    this.authenticated = false;
    const credentials = getTwitterCredentials();
    this.config = {
      username: credentials.username,
      password: credentials.password,
      email: credentials.email
    };
  }

  /**
   * Initialize cookie-based authentication session
   * @throws {TwitterAuthError} If authentication fails
   */
  public async initializeSession(): Promise<void> {
    try {
      const response = await fetch('https://twitter.com/i/flow/login', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new TwitterAuthError('Failed to initialize login session');
      }

      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        await this.jar.setCookie(cookies, 'https://twitter.com');
      }
    } catch (error) {
      throw new TwitterAuthError(`Session initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticate with Twitter using cookie-based approach
   * @throws {TwitterAuthError} If authentication fails
   */
  public async authenticate(): Promise<void> {
    if (this.authenticated) {
      return;
    }

    try {
      await this.initializeSession();
      
      // First authentication step
      const authResponse = await fetch('https://twitter.com/i/api/1.1/oauth/authenticate_user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Cookie: await this.jar.getCookieString('https://twitter.com')
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
          email: this.config.email
        })
      });

      if (!authResponse.ok) {
        throw new TwitterAuthError(`Authentication request failed with status ${authResponse.status}`);
      }

      const cookies = authResponse.headers.get('set-cookie');
      if (cookies) {
        await this.jar.setCookie(cookies, 'https://twitter.com');
      }

      // Handle potential two-factor or additional verification steps
      const authData = await authResponse.json();
      if (authData.requires_verification) {
        throw new TwitterAuthError('Two-factor authentication is required but not supported');
      }

      // Verify authentication success
      const verifyResponse = await fetch('https://twitter.com/i/api/1.1/account/verify_credentials.json', {
        headers: {
          Cookie: await this.jar.getCookieString('https://twitter.com')
        }
      });

      if (!verifyResponse.ok) {
        throw new TwitterAuthError('Failed to verify authentication');
      }

      this.authenticated = true;
    } catch (error) {
      throw new TwitterAuthError(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the cookie jar for authenticated requests
   * @throws {TwitterAuthError} If not authenticated
   */
  public getCookieJar(): CookieJar {
    if (!this.authenticated) {
      throw new TwitterAuthError('Not authenticated. Call authenticate() first.');
    }
    return this.jar;
  }

  /**
   * Check if the client is authenticated
   */
  public isAuthenticated(): boolean {
    return this.authenticated;
  }
}
