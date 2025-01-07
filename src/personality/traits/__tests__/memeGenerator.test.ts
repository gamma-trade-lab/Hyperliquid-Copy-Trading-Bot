import { MemeGenerator } from '../memeGenerator.js';
import { TraitManager } from '../traitManager.js';
import { IAIService } from '../../../services/ai/types.js';

import { jest } from '@jest/globals';
jest.mock('../traitManager.js');
jest.mock('../../../services/ai/ai.js');

describe('MemeGenerator', () => {
  let memeGenerator: MemeGenerator;
  let mockTraitManager: jest.Mocked<TraitManager>;
  let mockAIService: jest.Mocked<IAIService>;

  beforeEach(() => {
    mockTraitManager = {
      getActiveTraits: jest.fn().mockReturnValue(['meme-creativity']),
    } as unknown as jest.Mocked<TraitManager>;
    
    mockAIService = {
      generateResponse: jest.fn().mockResolvedValue('mocked response'),
    } as unknown as jest.Mocked<IAIService>;
    
    memeGenerator = new MemeGenerator(mockTraitManager, mockAIService);
  });

  describe('generateMeme', () => {
    test('should generate text meme with variables', async () => {
      const memeContext = {
        marketCondition: 'bullish' as const,
        recentEvents: ['price surge'],
        communityMood: 0.8,
        targetAudience: ['crypto-enthusiasts']
      };
      
      const meme = await memeGenerator.generateMeme(memeContext);
      expect(meme.content).toBeTruthy();
      expect(meme.template).toBeTruthy();
    });

    test('should throw error for invalid context', async () => {
      await expect(async () => {
        await memeGenerator.generateMeme({} as any);
      }).rejects.toThrow();
    });
  });

  describe('generateMeme with market data', () => {
    test('should generate bullish market meme', async () => {
      const memeContext = {
        marketCondition: 'bullish' as const,
        recentEvents: ['price surge'],
        communityMood: 0.8,
        targetAudience: ['traders']
      };

      const meme = await memeGenerator.generateMeme(memeContext);
      expect(meme.content).toBeTruthy();
      expect(meme.metrics.expectedViralScore).toBeGreaterThan(0);
    });

    test('should generate bearish market meme', async () => {
      const memeContext = {
        marketCondition: 'bearish' as const,
        recentEvents: ['price drop'],
        communityMood: 0.3,
        targetAudience: ['holders']
      };

      const meme = await memeGenerator.generateMeme(memeContext);
      expect(meme.content).toBeTruthy();
      expect(meme.metrics.expectedViralScore).toBeGreaterThan(0);
    });
  });
});
