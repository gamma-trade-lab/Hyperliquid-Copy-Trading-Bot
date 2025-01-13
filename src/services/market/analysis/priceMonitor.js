// src/services/market/analysis/priceMonitor.ts
import { EventEmitter } from 'events';
import { elizaLogger } from "@ai16z/eliza";
export class PriceMonitor extends EventEmitter {
    dataProcessor;
    aiService;
    priceHistory;
    alerts;
    monitoredTokens;
    updateIntervals;
    PRICE_HISTORY_LIMIT = 1000;
    DEFAULT_UPDATE_INTERVAL = 10000; // 10 seconds
    VOLATILITY_THRESHOLD = 0.05; // 5%
    MAX_RETRY_ATTEMPTS = 3;
    RETRY_DELAY = 1000; // 1 second
    constructor(dataProcessor, aiService) {
        super();
        this.dataProcessor = dataProcessor;
        this.aiService = aiService;
        this.priceHistory = new Map();
        this.alerts = new Map();
        this.monitoredTokens = new Set();
        this.updateIntervals = new Map();
    }
    async startMonitoring(tokenAddress, interval = this.DEFAULT_UPDATE_INTERVAL) {
        try {
            if (this.monitoredTokens.has(tokenAddress)) {
                elizaLogger.warn(`Already monitoring token: ${tokenAddress}`);
                return;
            }
            // Initialize with current data
            await this.addToken(tokenAddress);
            this.monitoredTokens.add(tokenAddress);
            // Start monitoring interval
            const updateInterval = setInterval(() => this.updateTokenPrice(tokenAddress), interval);
            this.updateIntervals.set(tokenAddress, updateInterval);
            elizaLogger.info(`Started monitoring ${tokenAddress} with ${interval}ms interval`);
        }
        catch (error) {
            elizaLogger.error(`Failed to start monitoring ${tokenAddress}:`, error);
            throw error;
        }
    }
    stopMonitoring(tokenAddress) {
        const interval = this.updateIntervals.get(tokenAddress);
        if (interval) {
            clearInterval(interval);
            this.updateIntervals.delete(tokenAddress);
            this.monitoredTokens.delete(tokenAddress);
            elizaLogger.info(`Stopped monitoring ${tokenAddress}`);
        }
    }
    async addToken(tokenAddress) {
        try {
            const marketData = await this.dataProcessor.getMarketData(tokenAddress);
            const pricePoint = {
                price: marketData.price,
                volume: marketData.volume24h,
                timestamp: Date.now(),
                source: 'initialization',
                volatility: marketData.volatility
            };
            this.priceHistory.set(tokenAddress, [pricePoint]);
            this.emit('tokenAdded', { tokenAddress, pricePoint });
        }
        catch (error) {
            elizaLogger.error('Error adding token:', error);
            throw error;
        }
    }
    async updateTokenPrice(tokenAddress) {
        let retryCount = 0;
        while (retryCount < this.MAX_RETRY_ATTEMPTS) {
            try {
                const marketData = await this.dataProcessor.getMarketData(tokenAddress);
                const pricePoint = {
                    price: marketData.price,
                    volume: marketData.volume24h,
                    timestamp: Date.now(),
                    source: 'update',
                    volatility: marketData.volatility
                };
                await this.processPriceUpdate(tokenAddress, pricePoint);
                break; // Success, exit retry loop
            }
            catch (error) {
                retryCount++;
                elizaLogger.warn(`Retry ${retryCount} failed for ${tokenAddress}:`, error);
                if (retryCount === this.MAX_RETRY_ATTEMPTS) {
                    elizaLogger.error(`Failed to update price after ${retryCount} attempts:`, error);
                    this.emit('updateError', { tokenAddress, error });
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retryCount));
                }
            }
        }
    }
    async processPriceUpdate(tokenAddress, pricePoint) {
        // Add to history
        this.addPricePoint(tokenAddress, pricePoint);
        // Check alerts
        await this.checkAlerts(tokenAddress, pricePoint);
        // Analyze significant movements
        await this.analyzeMovement(tokenAddress, pricePoint);
        // Emit update event
        this.emit('priceUpdated', { tokenAddress, pricePoint });
    }
    async createAlert(alert) {
        const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newAlert = {
            ...alert,
            id,
            triggered: false,
            createdAt: Date.now()
        };
        this.alerts.set(id, newAlert);
        this.emit('alertCreated', newAlert);
        return id;
    }
    addPricePoint(tokenAddress, pricePoint) {
        const history = this.priceHistory.get(tokenAddress) || [];
        history.push(pricePoint);
        if (history.length > this.PRICE_HISTORY_LIMIT) {
            history.shift();
        }
        this.priceHistory.set(tokenAddress, history);
    }
    async checkAlerts(tokenAddress, pricePoint) {
        for (const alert of this.alerts.values()) {
            if (alert.token !== tokenAddress || alert.triggered)
                continue;
            let triggered = false;
            const previousPrice = this.getPreviousPrice(tokenAddress);
            switch (alert.condition) {
                case 'above':
                    triggered = pricePoint.price > alert.value;
                    break;
                case 'below':
                    triggered = pricePoint.price < alert.value;
                    break;
                case 'change':
                    if (previousPrice) {
                        const change = Math.abs((pricePoint.price - previousPrice) / previousPrice);
                        triggered = change > alert.value;
                    }
                    break;
                case 'volatility':
                    triggered = (pricePoint.volatility || 0) > alert.value;
                    break;
            }
            if (triggered) {
                alert.triggered = true;
                this.emit('alertTriggered', { alert, pricePoint });
            }
        }
    }
    async analyzeMovement(tokenAddress, pricePoint) {
        const previousPrice = this.getPreviousPrice(tokenAddress);
        if (!previousPrice)
            return;
        const priceChange = (pricePoint.price - previousPrice) / previousPrice;
        if (Math.abs(priceChange) >= this.VOLATILITY_THRESHOLD) {
            const metrics = this.calculateTokenMetrics(tokenAddress);
            if (!metrics)
                return;
            const analysis = await this.generatePriceAnalysis(tokenAddress, priceChange, metrics);
            this.emit('significantMovement', {
                tokenAddress,
                priceChange,
                metrics,
                analysis
            });
        }
    }
    async generatePriceAnalysis(tokenAddress, priceChange, metrics) {
        const prompt = `
      Analyze this price movement:
      Token: ${tokenAddress}
      Price Change: ${(priceChange * 100).toFixed(2)}%
      Current Price: $${metrics.price}
      24h Volume: $${metrics.volume24h.toLocaleString()}
      Market Cap: $${metrics.marketCap.toLocaleString()}
      24h High/Low: $${metrics.highLow.high24h} / $${metrics.highLow.low24h}
      Volatility: ${(metrics.volatility * 100).toFixed(2)}%
      Total Holders: ${metrics.holders?.total || 'Unknown'}
      
      Provide a brief analysis of the movement and potential causes.
    `;
        return await this.aiService.generateResponse({
            content: prompt,
            author: 'system',
            platform: 'analysis'
        });
    }
    calculateTokenMetrics(tokenAddress) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length === 0)
            return null;
        const current = history[history.length - 1];
        const past24h = history.filter(p => p.timestamp > Date.now() - 24 * 60 * 60 * 1000);
        const dayAgo = history.find(p => p.timestamp <= Date.now() - 24 * 60 * 60 * 1000) || history[0];
        return {
            price: current.price,
            volume24h: past24h.reduce((sum, p) => sum + p.volume, 0),
            marketCap: 0, // Will be updated with actual data
            change24h: ((current.price - dayAgo.price) / dayAgo.price) * 100,
            volatility: current.volatility || 0,
            highLow: {
                high24h: Math.max(...past24h.map(p => p.price)),
                low24h: Math.min(...past24h.map(p => p.price))
            }
        };
    }
    getPreviousPrice(tokenAddress) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length < 2)
            return null;
        return history[history.length - 2].price;
    }
    getRecentPrices(tokenAddress, limit = 100) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history)
            return [];
        return history.slice(-limit);
    }
    cleanup() {
        // Clear all monitoring intervals
        this.updateIntervals.forEach(interval => clearInterval(interval));
        this.updateIntervals.clear();
        this.monitoredTokens.clear();
        elizaLogger.info('Price monitor cleaned up');
    }
}
