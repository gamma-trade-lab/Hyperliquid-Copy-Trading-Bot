// src/community/growth/rewardSystem.ts
import { EventEmitter } from 'events';
var RewardType;
(function (RewardType) {
    RewardType["TOKEN"] = "token";
    RewardType["NFT"] = "nft";
    RewardType["POINTS"] = "points";
    RewardType["ROLE"] = "role";
    RewardType["ACCESS"] = "access";
})(RewardType || (RewardType = {}));
var RewardStatus;
(function (RewardStatus) {
    RewardStatus["PENDING"] = "pending";
    RewardStatus["PROCESSING"] = "processing";
    RewardStatus["COMPLETED"] = "completed";
    RewardStatus["FAILED"] = "failed";
})(RewardStatus || (RewardStatus = {}));
export class RewardSystem extends EventEmitter {
    connection;
    rewardRules;
    pendingRewards;
    userRewards;
    MAX_PENDING_REWARDS = 1000;
    constructor(connection) {
        super();
        this.connection = connection;
        this.rewardRules = new Map();
        this.pendingRewards = new Map();
        this.userRewards = new Map();
        this.initializeDefaultRules();
    }
    initializeDefaultRules() {
        // Social engagement rewards
        this.addRule({
            id: 'social-engagement',
            action: 'post',
            conditions: [
                {
                    type: 'engagement',
                    operator: '>',
                    value: 10
                }
            ],
            reward: {
                type: RewardType.POINTS,
                amount: 5
            },
            cooldown: 3600 // 1 hour
        });
        // Community participation rewards
        this.addRule({
            id: 'community-participation',
            action: 'interaction',
            conditions: [
                {
                    type: 'time',
                    operator: '>',
                    value: 300 // 5 minutes
                }
            ],
            reward: {
                type: RewardType.POINTS,
                amount: 1
            },
            maxPerUser: 10,
            maxTotal: 1000
        });
        // Token holder rewards
        this.addRule({
            id: 'token-holder',
            action: 'hold',
            conditions: [
                {
                    type: 'time',
                    operator: '>',
                    value: 86400 // 24 hours
                }
            ],
            reward: {
                type: RewardType.TOKEN,
                amount: 10
            },
            cooldown: 86400 // 24 hours
        });
    }
    async processAction(userId, action, metadata) {
        try {
            const applicableRules = this.findApplicableRules(action);
            for (const rule of applicableRules) {
                if (await this.validateConditions(userId, rule, metadata)) {
                    return await this.createReward(userId, rule, metadata);
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error processing action:', error);
            throw error;
        }
    }
    findApplicableRules(action) {
        return Array.from(this.rewardRules.values())
            .filter(rule => rule.action === action)
            .sort((a, b) => (b.reward.amount - a.reward.amount));
    }
    async validateConditions(userId, rule, metadata) {
        for (const condition of rule.conditions) {
            const value = await this.getConditionValue(userId, condition.type, metadata);
            switch (condition.operator) {
                case '>':
                    if (!(value > condition.value))
                        return false;
                    break;
                case '<':
                    if (!(value < condition.value))
                        return false;
                    break;
                case '==':
                    if (value !== condition.value)
                        return false;
                    break;
                case 'between':
                    const [min, max] = condition.value;
                    if (!(value >= min && value <= max))
                        return false;
                    break;
            }
        }
        // Check cooldown
        if (rule.cooldown) {
            const lastReward = this.getLastUserReward(userId, rule.id);
            if (lastReward &&
                Date.now() - lastReward.metadata.timestamp < rule.cooldown) {
                return false;
            }
        }
        // Check max per user
        if (rule.maxPerUser) {
            const userRewardCount = this.getUserRewardCount(userId, rule.id);
            if (userRewardCount >= rule.maxPerUser) {
                return false;
            }
        }
        // Check max total
        if (rule.maxTotal) {
            const totalRewardCount = this.getTotalRewardCount(rule.id);
            if (totalRewardCount >= rule.maxTotal) {
                return false;
            }
        }
        return true;
    }
    async getConditionValue(userId, type, metadata) {
        switch (type) {
            case 'engagement':
                return metadata.engagement || 0;
            case 'time':
                return metadata.duration || 0;
            case 'level':
                return await this.getUserLevel(userId);
            case 'reputation':
                return await this.getUserReputation(userId);
            default:
                return 0;
        }
    }
    async createReward(userId, rule, metadata) {
        const reward = {
            id: `reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: rule.reward.type,
            amount: rule.reward.amount,
            recipient: userId,
            status: RewardStatus.PENDING,
            metadata: {
                action: rule.action,
                platform: metadata.platform || 'unknown',
                timestamp: Date.now(),
                details: metadata
            }
        };
        this.pendingRewards.set(reward.id, reward);
        await this.distributeReward(reward);
        return reward;
    }
    async distributeReward(reward) {
        try {
            reward.status = RewardStatus.PROCESSING;
            switch (reward.type) {
                case RewardType.TOKEN:
                    await this.distributeTokenReward(reward);
                    break;
                case RewardType.NFT:
                    await this.distributeNFTReward(reward);
                    break;
                case RewardType.POINTS:
                    await this.distributePointsReward(reward);
                    break;
                case RewardType.ROLE:
                    await this.distributeRoleReward(reward);
                    break;
                case RewardType.ACCESS:
                    await this.distributeAccessReward(reward);
                    break;
            }
            reward.status = RewardStatus.COMPLETED;
            this.addToUserRewards(reward);
            this.pendingRewards.delete(reward.id);
            this.emit('rewardDistributed', reward);
        }
        catch (error) {
            console.error('Error distributing reward:', error);
            reward.status = RewardStatus.FAILED;
            this.emit('rewardFailed', { reward, error });
        }
    }
    async distributeTokenReward(reward) {
        // Implement token distribution logic
    }
    async distributeNFTReward(reward) {
        // Implement NFT distribution logic
    }
    async distributePointsReward(reward) {
        // Implement points distribution logic
    }
    async distributeRoleReward(reward) {
        // Implement role assignment logic
    }
    async distributeAccessReward(reward) {
        // Implement access grant logic
    }
    addToUserRewards(reward) {
        const userRewards = this.userRewards.get(reward.recipient) || [];
        userRewards.push(reward);
        this.userRewards.set(reward.recipient, userRewards);
    }
    getLastUserReward(userId, ruleId) {
        const userRewards = this.userRewards.get(userId) || [];
        return userRewards
            .filter(reward => reward.metadata.details?.ruleId === ruleId)
            .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)[0];
    }
    getUserRewardCount(userId, ruleId) {
        const userRewards = this.userRewards.get(userId) || [];
        return userRewards.filter(reward => reward.metadata.details?.ruleId === ruleId).length;
    }
    getTotalRewardCount(ruleId) {
        return Array.from(this.userRewards.values())
            .flat()
            .filter(reward => reward.metadata.details?.ruleId === ruleId)
            .length;
    }
    addRule(rule) {
        this.rewardRules.set(rule.id, rule);
        this.emit('ruleAdded', rule);
    }
    removeRule(ruleId) {
        this.rewardRules.delete(ruleId);
        this.emit('ruleRemoved', ruleId);
    }
    getUserRewards(userId) {
        return this.userRewards.get(userId) || [];
    }
    async getUserLevel(userId) {
        // Implement level calculation logic
        return 1;
    }
    async getUserReputation(userId) {
        // Implement reputation calculation logic
        return 0;
    }
}
