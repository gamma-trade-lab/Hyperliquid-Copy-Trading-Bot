// src/community/growth/incentives.ts

import { EventEmitter } from 'events';
import { RewardSystem } from './rewardSystem.js';

interface Incentive {
  id: string;
  name: string;
  type: IncentiveType;
  description: string;
  conditions: IncentiveCondition[];
  rewards: IncentiveReward[];
  status: 'active' | 'paused' | 'completed';
  duration?: {
    start: number;
    end: number;
  };
  maxParticipants?: number;
  budget?: {
    total: number;
    used: number;
  };
}

interface IncentiveCondition {
  type: 'action' | 'timeframe' | 'threshold';
  requirement: string;
  value: any;
  metadata?: Record<string, any>;
}

interface IncentiveReward {
  type: 'token' | 'nft' | 'role' | 'access';
  amount: number;
  details: Record<string, any>;
}

enum IncentiveType {
  QUEST = 'quest',
  COMPETITION = 'competition',
  AIRDROP = 'airdrop',
  STAKING = 'staking',
  REFERRAL = 'referral'
}

interface ParticipantProgress {
  userId: string;
  incentiveId: string;
  progress: Record<string, any>;
  completed: boolean;
  rewardsClaimed: boolean;
  timestamp: number;
}

export class IncentiveSystem extends EventEmitter {
  private rewardSystem: RewardSystem;
  private incentives: Map<string, Incentive>;
  private participantProgress: Map<string, ParticipantProgress[]>;
  private readonly UPDATE_INTERVAL = 60000; // 1 minute

  constructor(rewardSystem: RewardSystem) {
    super();
    this.rewardSystem = rewardSystem;
    this.incentives = new Map();
    this.participantProgress = new Map();
    this.initializeDefaultIncentives();
    this.startProgressTracking();
  }

  private initializeDefaultIncentives(): void {
    // Daily engagement quest
    this.addIncentive({
      id: 'daily-engagement',
      name: 'Daily Community Champion',
      type: IncentiveType.QUEST,
      description: 'Engage with the community daily to earn rewards',
      conditions: [
        {
          type: 'action',
          requirement: 'post',
          value: 3
        },
        {
          type: 'action',
          requirement: 'react',
          value: 10
        }
      ],
      rewards: [
        {
          type: 'token',
          amount: 10,
          details: {
            token: 'community-token',
            vesting: 'immediate'
          }
        }
      ],
      status: 'active',
      duration: {
        start: Date.now(),
        end: Date.now() + 24 * 60 * 60 * 1000
      }
    });

    // Referral program
    this.addIncentive({
        id: 'referral-program',
        name: 'Community Growth Initiative',
        type: IncentiveType.REFERRAL,
        description: 'Invite new members to earn rewards',
        conditions: [
            {
                type: 'action',
                requirement: 'referral',
                value: 1
            },
            {
                type: 'threshold',
                requirement: 'referral_active',
                value: 7 // days
            }
        ],
        rewards: [
            {
                type: 'token',
                amount: 50,
                details: {
                    token: 'community-token',
                    vesting: '30-days'
                }
            }
        ],
        status: 'active'
    });
  }

  private startProgressTracking(): void {
    // Logic to start tracking participant progress
  }

  private addIncentive(incentive: Incentive): void {
    this.incentives.set(incentive.id, incentive);
  }
}