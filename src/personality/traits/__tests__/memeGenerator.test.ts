import { MemeGenerator } from '../memeGenerator';
import { TraitManager } from '../traitManager';
import { AIService } from '../../../services/ai/ai';

jest.mock('../traitManager');
jest.mock('../../../services/ai/ai');

describe('MemeGenerator', () => {
  let memeGenerator: MemeGenerator;
  let mockTraitManager: jest.Mocked<TraitManager>;
  let mockAIService: jest.Mocked<AIService>;

  beforeEach(() => {
    mockTraitManager = {
      getActiveTraits: jest.fn().mockReturnValue(['meme-creativity']),
    } as unknown as jest.Mocked<TraitManager>;
    
    mockAIService = {
      generateResponse: jest.fn().mockResolvedValue('mocked response'),
    } as unknown as jest.Mocked<AIService>;
    
    memeGenerator = new MemeGenerator(mockTraitManager, mockAIService);
  });

  describe('generateMemeText', () => {
    test('should generate text meme with variables', () => {
      const memeText = memeGenerator.generateMemeText('diamond-hands', {
        token: 'TEST',
        price: '1000.00'
      });

      expect(memeText).toContain('TEST');
      expect(memeText).not.toContain('{token}');
    });

    test('should throw error for invalid template', () => {
      expect(() => {
        memeGenerator.generateMemeText('invalid-template', {});
      }).toThrow('Template not found');
    });
  });

  describe('generateMarketMeme', () => {
    test('should generate bullish market meme', () => {
      const marketData = {
        price: 1234.56,
        priceChange24h: 5.5,
        volume24h: 1000000,
        marketCap: 50000000
      };

      const memeText = memeGenerator.generateMarketMeme(marketData);
      expect(memeText).toContain('moon');
      expect(memeText).toContain('1234.56');
    });

    test('should generate bearish market meme', () => {
      const marketData = {
        price: 1234.56,
        priceChange24h: -5.5,
        volume24h: 1000000,
        marketCap: 50000000
      };

      const memeText = memeGenerator.generateMarketMeme(marketData);
      expect(memeText).toContain('panic');
      expect(memeText).toContain('5.50');
    });
  });
});
