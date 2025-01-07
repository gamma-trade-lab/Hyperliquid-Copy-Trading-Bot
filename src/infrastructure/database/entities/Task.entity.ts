import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Agent } from './Agent.entity.js';
import { User } from './User.entity.js';

@Entity('tasks')
export class Task extends BaseEntity {
  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  })
  status!: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'jsonb', nullable: true })
  input!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  output!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;

  @Column()
  agentId!: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'float', nullable: true })
  executionTimeMs?: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;
}    