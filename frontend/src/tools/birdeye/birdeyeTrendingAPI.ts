import { BirdeyeToken } from '@/utils/birdeye';
import { getTrendingTokens } from '@/utils/birdeye';

export const birdeyeTrendingAPI = {
  getTrending: async (): Promise<BirdeyeToken[]> => {
    return await getTrendingTokens();
  }
};
