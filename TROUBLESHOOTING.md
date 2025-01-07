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
**Solution:**
- This is normal behavior
- Service will automatically retry with exponential backoff
- No action required unless it persists for >30 minutes

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
Force mock mode for testing:
```env
MOCK_TWITTER=true
MOCK_MARKET_DATA=true
```

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
