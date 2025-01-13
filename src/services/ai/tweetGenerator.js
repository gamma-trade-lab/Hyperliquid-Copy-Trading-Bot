import { GroqAIService } from './groq.js';
import { CONFIG } from '../../config/settings.js';
export class TweetGenerator {
    groqService;
    DEFAULT_MAX_LENGTH = 280;
    DEFAULT_STYLE = {
        tone: 'neutral',
        humor: 0.7,
        formality: 0.5
    };
    constructor() {
        this.groqService = new GroqAIService({
            groqApiKey: CONFIG.AI.GROQ.API_KEY,
            twitterApiKey: CONFIG.SOCIAL.TWITTER.tokens.appKey,
            twitterApiSecret: CONFIG.SOCIAL.TWITTER.tokens.appSecret,
            twitterAccessToken: CONFIG.SOCIAL.TWITTER.tokens.accessToken,
            twitterAccessSecret: CONFIG.SOCIAL.TWITTER.tokens.accessSecret
        });
    }
    async generateTweetContent(context) {
        try {
            const { marketData, communityMetrics, trendingTopics = [], style = this.DEFAULT_STYLE, constraints = { maxLength: this.DEFAULT_MAX_LENGTH, includeTickers: true, includeMetrics: true } } = context;
            console.log('Generating tweet with context:', {
                marketCondition: marketData ? this.determineMarketCondition(marketData) : 'unknown',
                style,
                hasMetrics: !!marketData,
                hasCommunityData: !!communityMetrics
            });
            if (marketData && (isNaN(marketData.price) || isNaN(marketData.volume24h))) {
                const error = {
                    name: 'TweetGenerationError',
                    message: 'Invalid market data provided',
                    code: 'MARKET_DATA_INVALID',
                    context: marketData
                };
                throw error;
            }
            const prompt = this.buildPrompt({
                marketData,
                communityMetrics,
                trendingTopics,
                style,
                constraints
            });
            let content = await this.groqService.generateTweet({
                marketCondition: this.determineMarketCondition(marketData),
                communityMetrics,
                recentTrends: trendingTopics
            });
            if (!content) {
                const error = {
                    name: 'TweetGenerationError',
                    message: 'No content generated',
                    code: 'CONTENT_GENERATION_FAILED',
                    context: { content }
                };
                throw error;
            }
            // Extract important elements before cleaning
            const emojis = content.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
            const hashtags = content.match(/#\w+/g) || [];
            const cashtags = content.match(/\$[A-Z]+/g) || [];
            // Clean and normalize content
            content = content
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            // Handle tweet length
            const maxLength = constraints?.maxLength || this.DEFAULT_MAX_LENGTH;
            const importantElements = [...hashtags, ...cashtags].join(' ');
            const emojiStr = emojis.join('');
            const maxContentLength = maxLength - importantElements.length - emojiStr.length - 1; // -1 for space
            if (content.length > maxContentLength) {
                // Find the last complete sentence that fits
                const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
                let truncatedContent = '';
                for (const sentence of sentences) {
                    if ((truncatedContent + sentence).length <= maxContentLength) {
                        truncatedContent += sentence;
                    }
                    else {
                        break;
                    }
                }
                // If no complete sentence fits or content is still too long, truncate with ellipsis
                if (!truncatedContent || truncatedContent.length > maxContentLength) {
                    content = content.substring(0, maxContentLength - 3).trim() + '...';
                }
                else {
                    content = truncatedContent.trim();
                }
            }
            // Add back important elements
            if (emojiStr || importantElements) {
                content = `${content} ${emojiStr}${importantElements ? ' ' + importantElements : ''}`.trim();
            }
            return {
                content,
                metadata: {
                    generatedAt: new Date(),
                    context: {
                        marketCondition: this.determineMarketCondition(marketData),
                        topics: trendingTopics,
                        style
                    }
                }
            };
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('Rate limit')) {
                    const rateError = {
                        name: 'TweetGenerationError',
                        message: 'Rate limit exceeded',
                        code: 'RATE_LIMIT_EXCEEDED',
                        context: error
                    };
                    throw rateError;
                }
                const genError = {
                    name: 'TweetGenerationError',
                    message: error.message,
                    code: 'CONTENT_GENERATION_FAILED',
                    context: error
                };
                throw genError;
            }
            throw error;
        }
    }
    buildPrompt(context) {
        const { marketData, style, constraints, communityMetrics } = context;
        let prompt = `Generate a market analysis tweet that is:
- Professional and data-focused
- Written in a clear ${style?.tone || 'neutral'} tone
- Using precise market terminology
- Maximum ${constraints?.maxLength || this.DEFAULT_MAX_LENGTH} characters
- Free of emojis and hashtags\n\n`;
        if (marketData && constraints?.includeMetrics) {
            prompt += `Market Data (use varied sentence structures, no emojis/hashtags):
Current Market Metrics:
- Asset Price: $${marketData.price.toFixed(4)} USD
- Period Change: ${marketData.priceChange24h.toFixed(2)}% over 24 hours
- Trading Volume: $${(marketData.volume24h / 1000000).toFixed(2)} million in last 24h
- Total Market Value: $${(marketData.marketCap / 1000000).toFixed(2)} million
- Holder Distribution: ${marketData.topHolders.length} unique addresses

Recent Blockchain Activity:
${marketData.onChainData ?
                `- Trading Activity: ${marketData.onChainData.recentSwaps} executed swaps
- Token Movement: ${marketData.onChainData.recentTransfers} transfer events
- Network Usage: ${marketData.onChainData.totalTransactions} total transactions` :
                '- Chain data updates pending'}

Market Intelligence:
- Overall Trend: ${this.determineMarketCondition(marketData)}
- Market Depth: ${marketData.volume24h > 1000000 ? 'Substantial liquidity' : marketData.volume24h > 100000 ? 'Average depth' : 'Developing liquidity'}
- Trading Pattern: ${marketData.onChainData?.recentSwaps !== undefined ? (marketData.onChainData.recentSwaps > 10 ? 'Active market participation' : marketData.onChainData.recentSwaps > 5 ? 'Steady trading flow' : 'Conservative trading activity') : 'No trading data'}\n\n`;
        }
        if (communityMetrics) {
            prompt += `Community Analysis (use natural language, avoid repetitive patterns):
- Community Size: ${communityMetrics.totalFollowers} total participants
- Recent Engagement: ${communityMetrics.activeUsers24h} members active in past 24 hours
- Market Confidence: ${communityMetrics.sentimentScore.toFixed(2)} confidence rating
- Vary descriptions and avoid formulaic updates
- Present metrics in context of market activity\n\n`;
        }
        prompt += `Style Guidelines:
- Keep it concise and professional (max ${constraints?.maxLength || this.DEFAULT_MAX_LENGTH} chars)
- Present market data clearly without emojis or hashtags
- Focus on price, volume, and on-chain metrics
- Include specific numerical data with proper formatting
- Maintain a clear, analytical tone
- Highlight significant market movements and trends
- Present on-chain activity data when relevant\n`;
        return prompt;
    }
    determineMarketCondition(marketData) {
        if (!marketData)
            return 'neutral';
        // Consider both price change and on-chain activity
        const priceChange = marketData.priceChange24h;
        const onChainActivity = marketData.onChainData?.recentSwaps || 0;
        // Strong signals
        if (priceChange > 5 && onChainActivity > 10)
            return 'very bullish';
        if (priceChange < -5 && onChainActivity > 10)
            return 'very bearish';
        // Moderate signals
        if (priceChange > 5)
            return 'bullish';
        if (priceChange < -5)
            return 'bearish';
        // Neutral with activity bias
        if (onChainActivity > 10)
            return 'active neutral';
        if (onChainActivity < 3)
            return 'quiet neutral';
        return 'neutral';
    }
    async generateThreadFromMarketUpdate(marketData) {
        return this.groqService.generateThreadFromMarketData(marketData);
    }
    async generateReply(mention) {
        return this.groqService.engageWithMention(mention);
    }
}
