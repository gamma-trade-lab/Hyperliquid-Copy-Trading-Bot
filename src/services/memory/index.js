import { ChromaClient } from 'chromadb';
import { EventEmitter } from 'events';
export class AgentMemoryService extends EventEmitter {
    client;
    collection;
    initialized = false;
    config;
    constructor(config) {
        super();
        this.config = config;
        this.client = new ChromaClient({
            path: `http://${config.chromaHost || 'localhost'}:${config.chromaPort || 8000}`
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            const collectionName = `${this.config.collectionPrefix || ''}${this.config.namespace}`;
            this.collection = await this.client.getOrCreateCollection({ name: collectionName });
            this.initialized = true;
            this.emit('initialized');
        }
        catch (error) {
            console.error('Failed to initialize memory service:', error);
            throw error;
        }
    }
    async createMemory(memory) {
        if (!this.initialized)
            await this.initialize();
        try {
            const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.collection.add({
                ids: [id],
                documents: [memory.content],
                metadatas: [{
                        category: memory.category,
                        timestamp: memory.timestamp,
                        ...memory.metadata
                    }]
            });
            this.emit('memoryCreated', { id, ...memory });
            return id;
        }
        catch (error) {
            console.error('Failed to create memory:', error);
            throw error;
        }
    }
    async searchMemories(options = {}) {
        if (!this.initialized)
            await this.initialize();
        try {
            const conditions = [];
            if (options.category) {
                conditions.push({ category: { $eq: options.category } });
            }
            if (options.timeRange) {
                conditions.push({ timestamp: { $gte: options.timeRange.start } });
                conditions.push({ timestamp: { $lte: options.timeRange.end } });
            }
            if (options.metadata) {
                Object.entries(options.metadata).forEach(([key, value]) => {
                    conditions.push({ [key]: { $eq: value } });
                });
            }
            const where = conditions.length === 1 ? conditions[0] :
                conditions.length > 1 ? { $and: conditions } : {};
            const results = await this.collection.query({
                queryTexts: [''], // Empty query text for filtering by where clause only
                where,
                nResults: options.limit
            });
            // Handle array of arrays structure from query results
            return results.ids[0].map((id, index) => ({
                id,
                content: results.documents[0][index],
                ...results.metadatas[0][index]
            }));
        }
        catch (error) {
            console.error('Failed to search memories:', error);
            throw error;
        }
    }
    async getMemoriesByCategory(category, time_range) {
        if (!this.initialized)
            await this.initialize();
        try {
            const where = { category: { $eq: category } };
            if (time_range) {
                Object.assign(where, {
                    timestamp: { $gte: time_range.start, $lte: time_range.end }
                });
            }
            const results = await this.collection.get({ where });
            return results.ids.map((id, index) => ({
                id,
                content: results.documents[index],
                ...results.metadatas[index]
            }));
        }
        catch (error) {
            console.error('Failed to get memories by category:', error);
            throw error;
        }
    }
    async deleteMemory(id) {
        if (!this.initialized)
            await this.initialize();
        try {
            await this.collection.delete({ ids: [id] });
            this.emit('memoryDeleted', id);
        }
        catch (error) {
            console.error('Failed to delete memory:', error);
            throw error;
        }
    }
    async clusterMemories(category) {
        const memories = await this.searchMemories({ category });
        // Implement DBSCAN clustering logic here
        // For now, return all memories in a single cluster
        return {
            clusters: [memories],
            noise: []
        };
    }
}
