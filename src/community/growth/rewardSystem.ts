// src/community/growth/rewardSystem.ts

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { EventEmitter } from 'events';

interface Reward {
  id: string;
  type: RewardType;
  amount: number;
  recipient: string;
  status: RewardStatus;
  metadata: {
    action: string;
    platform: string;
    timestamp: number;
    details?: Record<string, any>;
  };
}

enum RewardType {
  TOKEN = 'token',
  NFT = 'nft',
  POINTS = 'points',
  ROLE = 'role',
  ACCESS = 'access'
}

enum RewardStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

interface RewardRule {
  id: string;
  action: string;
  conditions: RewardCondition[];
  reward: {
    type: RewardType;
    amount: number;
    metadata?: Record<string, any>;
  };
  cooldown?: number;
  maxPerUser?: number;
  maxTotal?: number;
}

interface RewardCondition {
  type: 'engagement' | 'time' | 'level' | 'reputation';
  operator: '>' | '<' | '==' | 'between';
  value: number | [number, number];
}

export class RewardSystem extends EventEmitter {
  private connection: Connection;
  private rewardRules: Map<string, RewardRule>;
  private pendingRewards: Map<string, Reward>;
  private userRewards: Map<string, Reward[]>;
  private readonly MAX_PENDING_REWARDS = 1000;

  constructor(connection: Connection) {
    super();
    this.connection = connection;
    this.rewardRules = new Map();
    this.pendingRewards = new Map();
    this.userRewards = new Map();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
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

  public async processAction(
    userId: string,
    action: string,
    metadata: Record<string, any>
  ): Promise<Reward | null> {
    try {
      const applicableRules = this.findApplicableRules(action);
      
      for (const rule of applicableRules) {
        if (await this.validateConditions(userId, rule, metadata)) {
          return await this.createReward(userId, rule, metadata);
        }
      }

      return null;
    } catch (error) {
      console.error('Error processing action:', error);
      throw error;
    }
  }

  private findApplicableRules(action: string): RewardRule[] {
    return Array.from(this.rewardRules.values())
      .filter(rule => rule.action === action)
      .sort((a, b) => (b.reward.amount - a.reward.amount));
  }

  private async validateConditions(
    userId: string,
    rule: RewardRule,
    metadata: Record<string, any>
  ): Promise<boolean> {
    for (const condition of rule.conditions) {
      const value = await this.getConditionValue(userId, condition.type, metadata);
      
      switch (condition.operator) {
        case '>':
          if (!(value > (condition.value as number))) return false;
          break;
        case '<':
          if (!(value < (condition.value as number))) return false;
          break;
        case '==':
          if (value !== condition.value) return false;
          break;
        case 'between':
          const [min, max] = condition.value as [number, number];
          if (!(value >= min && value <= max)) return false;
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

  private async getConditionValue(
    userId: string,
    type: string,
    metadata: Record<string, any>
  ): Promise<number> {
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

  private async createReward(
    userId: string,
    rule: RewardRule,
    metadata: Record<string, any>
  ): Promise<Reward> {
    const reward: Reward = {
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

  private async distributeReward(reward: Reward): Promise<void> {
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
    } catch (error) {
      console.error('Error distributing reward:', error);
      reward.status = RewardStatus.FAILED;
      this.emit('rewardFailed', { reward, error });
    }
  }

  private async distributeTokenReward(reward: Reward): Promise<void> {
    // Implement token distribution logic
  }

  private async distributeNFTReward(reward: Reward): Promise<void> {
    // Implement NFT distribution logic
  }

  private async distributePointsReward(reward: Reward): Promise<void> {
    // Implement points distribution logic
  }

  private async distributeRoleReward(reward: Reward): Promise<void> {
    // Implement role assignment logic
  }

  private async distributeAccessReward(reward: Reward): Promise<void> {
    // Implement access grant logic
  }

  private addToUserRewards(reward: Reward): void {
    const userRewards = this.userRewards.get(reward.recipient) || [];
    userRewards.push(reward);
    this.userRewards.set(reward.recipient, userRewards);
  }

  private getLastUserReward(userId: string, ruleId: string): Reward | undefined {
    const userRewards = this.userRewards.get(userId) || [];
    return userRewards
      .filter(reward => reward.metadata.details?.ruleId === ruleId)
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)[0];
  }

  private getUserRewardCount(userId: string, ruleId: string): number {
    const userRewards = this.userRewards.get(userId) || [];
    return userRewards.filter(
      reward => reward.metadata.details?.ruleId === ruleId
    ).length;
  }

  private getTotalRewardCount(ruleId: string): number {
    return Array.from(this.userRewards.values())
      .flat()
      .filter(reward => reward.metadata.details?.ruleId === ruleId)
      .length;
  }

  public addRule(rule: RewardRule): void {
    this.rewardRules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  public removeRule(ruleId: string): void {
    this.rewardRules.delete(ruleId);
    this.emit('ruleRemoved', ruleId);
  }

  public getUserRewards(userId: string): Reward[] {
    return this.userRewards.get(userId) || [];
  }

  public async getUserLevel(userId: string): Promise<number> {
    // Implement level calculation logic
    return 1;
  }

  public async getUserReputation(userId: string): Promise<number> {
    // Implement reputation calculation logic
    return 0;
  }
}