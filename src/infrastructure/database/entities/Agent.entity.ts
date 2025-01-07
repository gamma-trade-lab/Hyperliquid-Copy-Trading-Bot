import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity';

@Entity('agents')
export class Agent extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column()
  type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  capabilities: string[];

  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metrics: {
    successRate?: number;
    totalTasks?: number;
    averageResponseTime?: number;
    errorRate?: number;
  };
} 