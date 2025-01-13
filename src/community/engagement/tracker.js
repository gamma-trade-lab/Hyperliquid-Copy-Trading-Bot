// src/community/engagement/tracker.ts
import { EventEmitter } from 'events';
var EngagementType;
(function (EngagementType) {
    EngagementType["POST"] = "post";
    EngagementType["COMMENT"] = "comment";
    EngagementType["REACTION"] = "reaction";
    EngagementType["SHARE"] = "share";
    EngagementType["CLICK"] = "click";
    EngagementType["VIEW"] = "view";
    EngagementType["REFERRAL"] = "referral";
})(EngagementType || (EngagementType = {}));
export class EngagementTracker extends EventEmitter {
    events;
    userEngagement;
    RETENTION_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days
    SCORE_WEIGHTS = {
        post: 5,
        comment: 3,
        reaction: 1,
        share: 4,
        click: 1,
        view: 0.1,
        referral: 10
    };
    constructor() {
        super();
        this.events = new Map();
        this.userEngagement = new Map();
        this.startPeriodicAnalysis();
    }
    async trackEvent(userId, type, platform, content, metadata = {}) {
        try {
            const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const event = {
                id: eventId,
                userId,
                type,
                platform,
                content,
                metadata: {
                    timestamp: Date.now(),
                    context: metadata.context || 'general',
                    referenceId: metadata.referenceId,
                    metrics: metadata.metrics
                }
            };
            this.events.set(eventId, event);
            await this.updateUserEngagement(userId, event);
            this.emit('eventTracked', event);
            return eventId;
        }
        catch (error) {
            console.error('Error tracking event:', error);
            throw error;
        }
    }
    async updateUserEngagement(userId, event) {
        let userEngagement = this.userEngagement.get(userId);
        if (!userEngagement) {
            userEngagement = {
                userId,
                totalEvents: 0,
                lastActive: 0,
                metrics: {
                    posts: 0,
                    comments: 0,
                    reactions: 0,
                    shares: 0
                },
                score: 0,
                badges: []
            };
        }
        // Update metrics
        userEngagement.totalEvents++;
        userEngagement.lastActive = Date.now();
        switch (event.type) {
            case EngagementType.POST:
                userEngagement.metrics.posts++;
                break;
            case EngagementType.COMMENT:
                userEngagement.metrics.comments++;
                break;
            case EngagementType.REACTION:
                userEngagement.metrics.reactions++;
                break;
            case EngagementType.SHARE:
                userEngagement.metrics.shares++;
                break;
        }
        // Calculate score
        userEngagement.score = this.calculateEngagementScore(userEngagement);
        // Update badges
        await this.updateBadges(userEngagement);
        this.userEngagement.set(userId, userEngagement);
        this.emit('userEngagementUpdated', userEngagement);
    }
    calculateEngagementScore(engagement) {
        const recentEvents = this.getRecentEvents(engagement.userId);
        let score = 0;
        // Calculate base score from event weights
        recentEvents.forEach(event => {
            score += this.SCORE_WEIGHTS[event.type] || 0;
            // Add bonus for engagement metrics
            if (event.metadata.metrics) {
                score += (event.metadata.metrics.likes * 0.1 +
                    event.metadata.metrics.comments * 0.3 +
                    event.metadata.metrics.shares * 0.5);
            }
        });
        // Apply time decay
        const recencyMultiplier = this.calculateRecencyMultiplier(engagement.lastActive);
        score *= recencyMultiplier;
        // Apply consistency bonus
        const consistencyBonus = this.calculateConsistencyBonus(engagement.userId);
        score *= consistencyBonus;
        return Math.round(score * 100) / 100;
    }
    calculateRecencyMultiplier(lastActive) {
        const daysInactive = (Date.now() - lastActive) / (24 * 60 * 60 * 1000);
        return Math.max(0.5, 1 - (daysInactive * 0.1));
    }
    calculateConsistencyBonus(userId) {
        const recentEvents = this.getRecentEvents(userId);
        const dailyEvents = new Map();
        recentEvents.forEach(event => {
            const date = new Date(event.metadata.timestamp).toDateString();
            dailyEvents.set(date, (dailyEvents.get(date) || 0) + 1);
        });
        const activeDays = dailyEvents.size;
        const totalDays = 30;
        const consistencyRatio = activeDays / totalDays;
        return 1 + (consistencyRatio * 0.5);
    }
    async updateBadges(engagement) {
        const newBadges = [];
        // Post count badges
        if (engagement.metrics.posts >= 100)
            newBadges.push('prolific-poster');
        if (engagement.metrics.posts >= 500)
            newBadges.push('content-creator');
        // Comment count badges
        if (engagement.metrics.comments >= 200)
            newBadges.push('active-commenter');
        if (engagement.metrics.comments >= 1000)
            newBadges.push('conversation-master');
        // Score badges
        if (engagement.score >= 1000)
            newBadges.push('engagement-pro');
        if (engagement.score >= 5000)
            newBadges.push('community-leader');
        // Add new badges
        newBadges.forEach(badge => {
            if (!engagement.badges.includes(badge)) {
                engagement.badges.push(badge);
                this.emit('badgeEarned', { userId: engagement.userId, badge });
            }
        });
    }
    getRecentEvents(userId) {
        const cutoff = Date.now() - this.RETENTION_WINDOW;
        return Array.from(this.events.values())
            .filter(event => event.userId === userId &&
            event.metadata.timestamp >= cutoff)
            .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
    }
    startPeriodicAnalysis() {
        setInterval(() => {
            this.analyzeEngagementTrends();
        }, 3600000); // Every hour
    }
    async analyzeEngagementTrends() {
        const trends = {
            activeUsers: this.getActiveUsers(),
            topContent: this.getTopContent(),
            engagementRates: this.calculateEngagementRates(),
            retentionMetrics: await this.calculateRetentionMetrics()
        };
        this.emit('trendsAnalyzed', trends);
    }
    getUserEngagement(userId) {
        return this.userEngagement.get(userId) || null;
    }
    getTopEngagedUsers(limit = 10) {
        return Array.from(this.userEngagement.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    getEventHistory(userId, type) {
        return Array.from(this.events.values())
            .filter(event => event.userId === userId &&
            (!type || event.type === type))
            .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
    }
    getActiveUsers() {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);
        return Array.from(this.userEngagement.values())
            .filter(user => user.lastActive >= dayAgo)
            .length;
    }
    getTopContent() {
        return Array.from(this.events.values())
            .filter(event => event.content && event.metadata.metrics)
            .sort((a, b) => {
            const scoreA = this.calculateContentScore(a.metadata.metrics);
            const scoreB = this.calculateContentScore(b.metadata.metrics);
            return scoreB - scoreA;
        })
            .slice(0, 10)
            .map(event => ({
            content: event.content,
            metrics: event.metadata.metrics
        }));
    }
    calculateContentScore(metrics) {
        return (metrics.likes +
            metrics.comments * 3 +
            metrics.shares * 5 +
            (metrics.clickThrough || 0) * 2);
    }
    calculateEngagementRates() {
        const total = Array.from(this.events.values()).length;
        const byType = new Map();
        this.events.forEach(event => {
            byType.set(event.type, (byType.get(event.type) || 0) + 1);
        });
        const rates = {};
        byType.forEach((count, type) => {
            rates[type] = count / total;
        });
        return rates;
    }
    async calculateRetentionMetrics() {
        const now = Date.now();
        const users = Array.from(this.userEngagement.values());
        return {
            daily: this.calculateRetentionRate(users, now - 24 * 60 * 60 * 1000),
            weekly: this.calculateRetentionRate(users, now - 7 * 24 * 60 * 60 * 1000),
            monthly: this.calculateRetentionRate(users, now - 30 * 24 * 60 * 60 * 1000)
        };
    }
    calculateRetentionRate(users, since) {
        const retained = users.filter(user => user.lastActive >= since).length;
        return retained / users.length;
    }
}
