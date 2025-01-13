// src/services/ai/integration/marketIntegration.ts
import { EventEmitter } from 'events';
var MarketEventType;
(function (MarketEventType) {
    MarketEventType["PRICE_MOVEMENT"] = "price_movement";
    MarketEventType["VOLUME_SPIKE"] = "volume_spike";
    MarketEventType["TREND_CHANGE"] = "trend_change";
    MarketEventType["LIQUIDITY_CHANGE"] = "liquidity_change";
    MarketEventType["SENTIMENT_SHIFT"] = "sentiment_shift";
})(MarketEventType || (MarketEventType = {}));
export class MarketIntegration extends EventEmitter {
    connection;
    aiService;
    dataSources;
    marketCache;
    UPDATE_INTERVAL = 5000; // 5 seconds
    CACHE_DURATION = 3600000; // 1 hour
    constructor(connection, aiService) {
        super();
        this.connection = connection;
        this.aiService = aiService;
        this.dataSources = new Map();
        this.marketCache = new Map();
        this.initializeDataSources();
        this.startMarketMonitoring();
    }
    initializeDataSources() {
        // Jupiter aggregator
        this.addDataSource({
            id: 'jupiter',
            name: 'Jupiter',
            type: 'aggregator',
            endpoint: 'https://quote-api.jup.ag/v4',
            priority: 1,
            status: 'active'
        });
        // Pyth oracle
        this.addDataSource({
            id: 'pyth',
            name: 'Pyth',
            type: 'oracle',
            endpoint: 'https://api.pyth.network',
            priority: 2,
            status: 'active'
        });
        // Orca DEX
        this.addDataSource({
            id: 'orca',
            name: 'Orca',
            type: 'dex',
            endpoint: 'https://api.orca.so',
            priority: 3,
            status: 'active'
        });
    }
    async getMarketData(token, options = {}) {
        try {
            let data = [];
            // Check cache first
            const cachedData = this.marketCache.get(token);
            if (cachedData && !options.timeframe) {
                return cachedData;
            }
            // Fetch from specified source or all sources
            if (options.source) {
                data = await this.fetchFromSource(token, options.source);
            }
            else {
                data = await this.fetchFromAllSources(token);
            }
            // Aggregate data if requested
            if (options.aggregate) {
                data = this.aggregateMarketData(data);
            }
            // Filter by timeframe if specified
            if (options.timeframe) {
                const cutoff = Date.now() - options.timeframe;
                data = data.filter(d => d.timestamp >= cutoff);
            }
            // Update cache
            this.updateCache(token, data);
            return data;
        }
        catch (error) {
            console.error('Error fetching market data:', error);
            throw error;
        }
    }
    async fetchFromSource(token, sourceId) {
        const source = this.dataSources.get(sourceId);
        if (!source) {
            throw new Error(`Data source not found: ${sourceId}`);
        }
        switch (source.type) {
            case 'aggregator':
                return await this.fetchFromAggregator(token, source);
            case 'oracle':
                return await this.fetchFromOracle(token, source);
            case 'dex':
                return await this.fetchFromDex(token, source);
            default:
                throw new Error(`Unsupported source type: ${source.type}`);
        }
    }
    async fetchFromAllSources(token) {
        const activeSources = Array.from(this.dataSources.values())
            .filter(source => source.status === 'active')
            .sort((a, b) => a.priority - b.priority);
        const promises = activeSources.map(source => this.fetchFromSource(token, source.id)
            .catch(error => {
            console.error(`Error fetching from ${source.name}:`, error);
            return [];
        }));
        const results = await Promise.all(promises);
        return results.flat();
    }
    aggregateMarketData(data) {
        const aggregated = new Map();
        const interval = 60000; // 1 minute intervals
        // Group by time intervals
        data.forEach(d => {
            const timeKey = Math.floor(d.timestamp / interval) * interval;
            const group = aggregated.get(timeKey) || [];
            group.push(d);
            aggregated.set(timeKey, group);
        });
        // Aggregate each group
        return Array.from(aggregated.entries()).map(([timestamp, group]) => ({
            token: group[0].token,
            price: this.calculateWeightedAverage(group, 'price'),
            volume: group.reduce((sum, d) => sum + d.volume, 0),
            timestamp,
            source: 'aggregated',
            metadata: {
                sourceCount: group.length,
                minPrice: Math.min(...group.map(d => d.price)),
                maxPrice: Math.max(...group.map(d => d.price))
            }
        }));
    }
    calculateWeightedAverage(data, field) {
        const totalWeight = data.reduce((sum, d) => sum + d.volume, 0);
        const weightedSum = data.reduce((sum, d) => sum + d[field] * d.volume, 0);
        return weightedSum / totalWeight;
    }
    async detectMarketEvents(token, data) {
        const events = [];
        // Price movement detection
        const priceEvents = await this.detectPriceMovements(data);
        events.push(...priceEvents);
        // Volume spike detection
        const volumeEvents = await this.detectVolumeSpikes(data);
        events.push(...volumeEvents);
        // Trend change detection
        const trendEvents = await this.detectTrendChanges(data);
        events.push(...trendEvents);
        // AI-enhanced event analysis
        const enrichedEvents = await this.enrichEventsWithAI(events, data);
        return enrichedEvents;
    }
    async detectPriceMovements(data) {
        // Implement price movement detection logic
        return [];
    }
    async detectVolumeSpikes(data) {
        // Implement volume spike detection logic
        return [];
    }
    async detectTrendChanges(data) {
        // Implement trend change detection logic
        return [];
    }
    async enrichEventsWithAI(events, data) {
        // Use AI service to enrich event detection
        return events;
    }
    startMarketMonitoring() {
        setInterval(async () => {
            try {
                for (const [token] of this.marketCache) {
                    const data = await this.getMarketData(token);
                    const events = await this.detectMarketEvents(token, data);
                    events.forEach(event => {
                        this.emit('marketEvent', event);
                    });
                }
            }
            catch (error) {
                console.error('Error in market monitoring:', error);
            }
        }, this.UPDATE_INTERVAL);
    }
    addDataSource(source) {
        this.dataSources.set(source.id, source);
        this.emit('sourceAdded', source);
    }
    updateCache(token, data) {
        this.marketCache.set(token, data);
        // Clean old cache entries
        const now = Date.now();
        for (const [token, data] of this.marketCache.entries()) {
            const oldestDataPoint = Math.min(...data.map(d => d.timestamp));
            if (now - oldestDataPoint > this.CACHE_DURATION) {
                this.marketCache.delete(token);
            }
        }
    }
    getDataSources() {
        return Array.from(this.dataSources.values());
    }
    async validateDataSource(sourceId) {
        const source = this.dataSources.get(sourceId);
        if (!source)
            return false;
        try {
            await this.testConnection(source);
            return true;
        }
        catch (error) {
            console.error(`Error validating data source ${sourceId}:`, error);
            return false;
        }
    }
    async testConnection(source) {
        // Implement connection testing logic
    }
    async fetchFromAggregator(token, source) {
        // Implement logic to fetch data from an aggregator
        return [];
    }
    async fetchFromOracle(token, source) {
        // Implement logic to fetch data from an oracle
        return [];
    }
    async fetchFromDex(token, source) {
        // Implement logic to fetch data from a DEX
        return [];
    }
}
