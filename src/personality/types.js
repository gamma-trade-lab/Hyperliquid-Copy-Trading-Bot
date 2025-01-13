import { z } from 'zod';
export const CharacterSchema = z.object({
    name: z.string(),
    description: z.string(),
    clients: z.array(z.enum(['twitter'])),
    modelConfigurations: z.object({
        primary: z.object({
            provider: z.string(),
            model: z.string(),
            temperature: z.number(),
            maxTokens: z.number(),
            topP: z.number(),
            frequencyPenalty: z.number(),
            presencePenalty: z.number()
        }),
        fallback: z.object({
            provider: z.string(),
            model: z.string(),
            temperature: z.number(),
            maxTokens: z.number(),
            topP: z.number(),
            frequencyPenalty: z.number(),
            presencePenalty: z.number()
        })
    }),
    templates: z.object({
        twitterPostTemplate: z.string(),
        twitterReplyTemplate: z.string()
    }),
    capabilities: z.object({
        trading: z.boolean(),
        analysis: z.boolean(),
        socialPosting: z.boolean(),
        marketMonitoring: z.boolean(),
        riskManagement: z.boolean(),
        portfolioOptimization: z.boolean()
    }),
    tradingConfig: z.object({
        maxPositionSize: z.number(),
        stopLoss: z.number(),
        takeProfit: z.number(),
        maxDailyTrades: z.number()
    })
});
