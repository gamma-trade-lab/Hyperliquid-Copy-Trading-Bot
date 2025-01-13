// src/community/growth/incentives.ts
import { EventEmitter } from 'events';
var IncentiveType;
(function (IncentiveType) {
    IncentiveType["QUEST"] = "quest";
    IncentiveType["COMPETITION"] = "competition";
    IncentiveType["AIRDROP"] = "airdrop";
    IncentiveType["STAKING"] = "staking";
    IncentiveType["REFERRAL"] = "referral";
})(IncentiveType || (IncentiveType = {}));
export class IncentiveSystem extends EventEmitter {
    rewardSystem;
    incentives;
    participantProgress;
    UPDATE_INTERVAL = 60000; // 1 minute
    constructor(rewardSystem) {
        super();
        this.rewardSystem = rewardSystem;
        this.incentives = new Map();
        this.participantProgress = new Map();
        this.initializeDefaultIncentives();
        this.startProgressTracking();
    }
    initializeDefaultIncentives() {
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
    startProgressTracking() {
        // Logic to start tracking participant progress
    }
    addIncentive(incentive) {
        this.incentives.set(incentive.id, incentive);
    }
}
