// src/services/ai/llm/contextManager.ts
import { EventEmitter } from 'events';
var ContextType;
(function (ContextType) {
    ContextType["SYSTEM"] = "system";
    ContextType["USER"] = "user";
    ContextType["ASSISTANT"] = "assistant";
    ContextType["MEMORY"] = "memory";
    ContextType["MARKET"] = "market";
})(ContextType || (ContextType = {}));
export class ContextManager extends EventEmitter {
    contexts;
    windows;
    DEFAULT_WINDOW_SIZE = 4096;
    MAX_CONTEXTS = 1000;
    CLEANUP_INTERVAL = 3600000; // 1 hour
    constructor() {
        super();
        this.contexts = new Map();
        this.windows = new Map();
        this.startPeriodicCleanup();
    }
    async addContext(context) {
        try {
            const id = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newContext = {
                ...context,
                id,
                metadata: {
                    ...context.metadata,
                    timestamp: Date.now()
                }
            };
            // Generate embeddings if needed
            if (!newContext.embeddings) {
                newContext.embeddings = await this.generateEmbeddings(newContext.content);
            }
            this.contexts.set(id, newContext);
            this.emit('contextAdded', newContext);
            return id;
        }
        catch (error) {
            console.error('Error adding context:', error);
            throw error;
        }
    }
    async createWindow(options = {}) {
        try {
            const id = `window-${Date.now()}`;
            const window = {
                id,
                contexts: [],
                size: 0,
                maxSize: options.maxSize || this.DEFAULT_WINDOW_SIZE,
                metadata: {
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    topic: options.topic
                }
            };
            if (options.contexts) {
                for (const contextId of options.contexts) {
                    await this.addToWindow(window.id, contextId);
                }
            }
            this.windows.set(id, window);
            this.emit('windowCreated', window);
            return id;
        }
        catch (error) {
            console.error('Error creating context window:', error);
            throw error;
        }
    }
    async addToWindow(windowId, contextId, position) {
        const window = this.windows.get(windowId);
        const context = this.contexts.get(contextId);
        if (!window || !context) {
            throw new Error('Window or context not found');
        }
        // Check size constraints
        const newSize = this.estimateTokenSize(context.content);
        if (window.size + newSize > window.maxSize) {
            await this.optimizeWindow(window);
            if (window.size + newSize > window.maxSize) {
                throw new Error('Context window size limit exceeded');
            }
        }
        // Add context to window
        if (typeof position === 'number') {
            window.contexts.splice(position, 0, context);
        }
        else {
            window.contexts.push(context);
        }
        window.size += newSize;
        window.metadata.updatedAt = Date.now();
        this.emit('contextAddedToWindow', { windowId, contextId });
    }
    async optimizeWindow(window) {
        const contexts = window.contexts;
        if (contexts.length === 0)
            return;
        // Calculate relevance scores
        const scores = await Promise.all(contexts.map(ctx => this.calculateRelevance(ctx, window)));
        // Sort by relevance and priority
        const sortedContexts = contexts
            .map((ctx, index) => ({
            context: ctx,
            score: scores[index]
        }))
            .sort((a, b) => {
            const priorityDiff = b.context.metadata.priority - a.context.metadata.priority;
            return priorityDiff !== 0 ? priorityDiff : b.score - a.score;
        });
        // Keep most relevant contexts within size limit
        let totalSize = 0;
        const keptContexts = [];
        for (const { context } of sortedContexts) {
            const size = this.estimateTokenSize(context.content);
            if (totalSize + size <= window.maxSize) {
                keptContexts.push(context);
                totalSize += size;
            }
            else {
                break;
            }
        }
        window.contexts = keptContexts;
        window.size = totalSize;
        this.emit('windowOptimized', window);
    }
    async calculateRelevance(context, window) {
        let score = 0;
        // Time decay
        const age = Date.now() - context.metadata.timestamp;
        const timeScore = Math.exp(-age / (24 * 60 * 60 * 1000)); // 24 hours half-life
        score += timeScore * 0.3;
        // Semantic similarity if embeddings exist
        if (context.embeddings && window.metadata.topic) {
            const topicEmbedding = await this.generateEmbeddings(window.metadata.topic);
            const similarity = this.calculateCosineSimilarity(context.embeddings, topicEmbedding);
            score += similarity * 0.4;
        }
        // Relationship bonus
        if (context.relations) {
            const relatedContexts = window.contexts.filter(c => context.relations.includes(c.id));
            score += (relatedContexts.length / window.contexts.length) * 0.3;
        }
        return score;
    }
    async generateEmbeddings(text) {
        // Implement embedding generation
        // This would typically use a service like OpenAI's embeddings API
        return [];
    }
    calculateCosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }
    estimateTokenSize(text) {
        // Simple token estimation (approx 4 chars per token)
        return Math.ceil(text.length / 4);
    }
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL);
    }
    cleanup() {
        const now = Date.now();
        // Clean expired contexts
        for (const [id, context] of this.contexts) {
            if (context.metadata.expiresAt &&
                context.metadata.expiresAt < now) {
                this.contexts.delete(id);
                this.emit('contextExpired', context);
            }
        }
        // Clean empty windows
        for (const [id, window] of this.windows) {
            if (window.contexts.length === 0) {
                this.windows.delete(id);
                this.emit('windowRemoved', window);
            }
        }
        // Maintain maximum context limit
        if (this.contexts.size > this.MAX_CONTEXTS) {
            const sortedContexts = Array.from(this.contexts.values())
                .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
            const toRemove = sortedContexts.slice(0, this.contexts.size - this.MAX_CONTEXTS);
            toRemove.forEach(context => {
                this.contexts.delete(context.id);
                this.emit('contextRemoved', context);
            });
        }
    }
    getContext(contextId) {
        return this.contexts.get(contextId);
    }
    getWindow(windowId) {
        return this.windows.get(windowId);
    }
    async searchContexts(query, options = {}) {
        const queryEmbedding = await this.generateEmbeddings(query);
        const results = [];
        for (const context of this.contexts.values()) {
            if (options.type && context.type !== options.type)
                continue;
            let relevance = 0;
            if (context.embeddings) {
                relevance = this.calculateCosineSimilarity(context.embeddings, queryEmbedding);
            }
            if (!options.minRelevance || relevance >= options.minRelevance) {
                results.push({ context, relevance });
            }
        }
        results.sort((a, b) => b.relevance - a.relevance);
        return options.maxResults ? results.slice(0, options.maxResults) : results;
    }
}
