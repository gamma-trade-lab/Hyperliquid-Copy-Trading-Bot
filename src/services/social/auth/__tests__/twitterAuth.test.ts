import { TwitterCookieAuth } from '../twitterAuth.js';
import { TwitterAuthError } from '../../../../types/errors.js';
import { CookieJar } from 'tough-cookie';

import { jest } from '@jest/globals';
jest.mock('node-fetch');

describe('TwitterCookieAuth', () => {
  let auth: TwitterCookieAuth;
  
  beforeEach(() => {
    // Mock environment variables
    process.env.twitter_username = 'test_user';
    process.env.twitter_password = 'placeholder_password';
    process.env.twitter_email = 'placeholder@example.test';
    auth = new TwitterCookieAuth();
  });

  it('should initialize with a cookie jar', () => {
    expect(auth['jar']).toBeInstanceOf(CookieJar);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('should initialize session successfully', async () => {
    const mockFetch = jest.requireMock('node-fetch').default;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('session=123; path=/; domain=.twitter.com')
      }
    });

    await auth.initializeSession();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://twitter.com/i/flow/login',
      expect.any(Object)
    );
  });

  it('should authenticate successfully', async () => {
    const mockFetch = jest.requireMock('node-fetch').default;
    
    // Mock session initialization
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('session=123; path=/; domain=.twitter.com')
      }
    });

    // Mock authentication response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('auth=456; path=/; domain=.twitter.com')
      },
      json: jest.fn().mockResolvedValue({ requires_verification: false })
    });

    // Mock verification response
    mockFetch.mockResolvedValueOnce({
      ok: true
    });

    await auth.authenticate();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('should throw error on authentication failure', async () => {
    const mockFetch = jest.requireMock('node-fetch').default;
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('session=123')
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401
    });

    await expect(auth.authenticate()).rejects.toThrow(TwitterAuthError);
  });

  it('should throw error when two-factor auth is required', async () => {
    const mockFetch = jest.requireMock('node-fetch').default;
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('session=123')
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue('auth=456')
      },
      json: jest.fn().mockResolvedValue({ requires_verification: true })
    });

    await expect(auth.authenticate()).rejects.toThrow('Two-factor authentication is required but not supported');
  });
});
