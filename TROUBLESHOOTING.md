# Troubleshooting Guide

## Common Issues and Solutions

### Environment Setup

#### Missing Environment Variables
```
Error: Twitter credentials not properly configured
```
**Solution:**
1. Check `.env` file exists
2. Verify required variables are set:
   - `TWITTER_USERNAME`
   - `TWITTER_PASSWORD`
   - `TWITTER_EMAIL`
   - Database credentials (Redis/PostgreSQL)
   - AI model API keys

#### Database Connection Issues

##### Redis Connection Failed
```
Error: NOAUTH Authentication required
```
**Solution:**
1. Verify Redis is running:
   ```bash
   sudo systemctl status redis-server
   ```
2. Check Redis credentials in `.env`:
   ```env
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=your_password
   ```
3. Test connection:
   ```bash
   redis-cli -a your_password ping
   ```

##### PostgreSQL Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:**
1. Check PostgreSQL service:
   ```bash
   sudo systemctl status postgresql
   ```
2. Verify database exists:
   ```bash
   sudo -u postgres psql -c '\l' | grep meme_agent_db
   ```
3. Test connection:
   ```bash
   psql -h localhost -U meme_agent_user -d meme_agent_db -c '\conninfo'
   ```

### Twitter Integration

#### Authentication Issues

##### Login Failed
```
Error: Failed to verify Twitter login status
```
**Solution:**
1. Verify credentials in `.env`
2. Check for rate limiting (wait 15 minutes)
3. Clear cookies and retry:
   ```bash
   rm -rf .cache/twitter-cookies
   ```

##### ACID Challenge Error (Code 399)
```
Twitter anti-automation check triggered (ACID challenge)
```
**Important Note:**
The ACID challenge (Error Code 399) is part of Twitter's normal authentication flow and does not indicate a failure. This is expected behavior when using the agent-twitter-client implementation.

**Solution:**
1. No immediate action required - the system handles this automatically:
   - Implements exponential backoff retry strategy
   - Default 3 retry attempts with increasing delays
   - Automatic session recovery after successful challenge

2. If persisting beyond 30 minutes:
   ```bash
   # Check authentication logs
   tail -f logs/social.log | grep "ACID"
   
   # Verify retry configuration
   grep TWITTER_MAX_RETRIES .env
   ```

3. Adjust retry settings if needed:
   ```env
   TWITTER_MAX_RETRIES=5        # Increase retry attempts
   TWITTER_RETRY_DELAY=10000    # Increase delay between retries
   ```

##### Suspicious Login Notifications
```
Received "Suspicious login attempt detected" from Twitter
```
**Important Note:**
This is normal and expected behavior when using the agent-twitter-client implementation. A successful login may trigger Twitter's suspicious login notification system.

**Solution:**
1. No action required - this indicates successful authentication
2. System will proceed with normal operation
3. Monitor logs for actual authentication status:
   ```bash
   tail -f logs/social.log | grep "authentication"
   ```

4. If concerned, verify session status:
   ```bash
   pnpm run check:twitter-session
   ```

#### Rate Limiting
```
Error: Too many requests
```
**Solution:**
1. Check current limits:
   ```bash
   grep "rate limit" logs/social.log
   ```
2. Wait 15 minutes before retrying
3. Adjust intervals in `.env`:
   ```env
   CONTENT_GENERATION_INTERVAL=300000
   MARKET_MONITORING_INTERVAL=60000
   ```

### Build and Runtime Issues

#### ESM Module Errors
```
Error: require is not defined
```
**Solution:**
1. Check `package.json` has:
   ```json
   {
     "type": "module"
   }
   ```
2. Use `.js` extensions in imports
3. Replace require() with dynamic imports

#### TypeScript Build Errors
```
Error: Cannot find module
```
**Solution:**
1. Clean build:
   ```bash
   rm -rf dist/
   pnpm build
   ```
2. Check `tsconfig.json` settings
3. Verify all dependencies installed:
   ```bash
   pnpm install
   ```

### Debugging Tools

#### Log Files
- Application logs: `logs/app.log`
- Social media: `logs/social.log`
- Market data: `logs/market.log`
- Database: `logs/db.log`

#### Debug Mode
Enable debug logging:
```env
LOG_LEVEL=debug
ENABLE_DEBUG=true
```

#### Mock Mode
Enable mock mode for development and testing:
```env
TWITTER_MOCK_MODE=true     # Enable Twitter mock mode
MOCK_MARKET_DATA=true      # Enable market data mocking
```

**Use Cases:**
1. Development without Twitter credentials
2. Testing content generation
3. CI/CD environments
4. Rate limit avoidance during testing

**Verification:**
1. Check mock mode status:
   ```bash
   grep "Running in mock mode" logs/social.log
   ```

2. Verify mock tweets:
   ```bash
   tail -f logs/mock_tweets.log
   ```

3. Test content generation:
   ```bash
   pnpm test src/services/social/__tests__/
   ```

**Important Notes:**
- Mock mode simulates all Twitter operations
- Tweets are logged but not posted
- Rate limits are not enforced
- Perfect for development and testing

### Character Configuration

#### Character Loading Failed
```
Error: Failed to load character configuration
```
**Solution:**
1. Verify character file exists:
   ```bash
   ls characters/jenna.character.json
   ```
2. Validate JSON format
3. Check required fields present:
   - name
   - modelConfigurations
   - personality traits

### Memory Service Issues

#### MongoDB Optional Dependency
```
Error: MongooseServerSelectionError
```
**Solution:**
- MongoDB is optional
- System will continue without it
- To enable MongoDB:
  ```bash
  sudo systemctl start mongod
  ```

## Getting Help

### Support Resources
1. Check logs in `logs/` directory
2. Review documentation in `docs/`
3. Search issues on GitHub
4. Run tests for specific components:
   ```bash
   pnpm test src/services/social/auth/__tests__/twitterAuth.test.ts
   ```

### Debug Commands
```bash
# Check service status
sudo systemctl status redis-server postgresql

# View logs
tail -f logs/social.log
tail -f logs/app.log

# Test database connections
redis-cli -a $REDIS_PASSWORD ping
psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -c '\conninfo'

# Run specific tests
pnpm test src/services/social/auth/__tests__/twitterAuth.test.ts
```
