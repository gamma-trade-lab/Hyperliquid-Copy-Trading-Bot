import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Agent } from './Agent.entity.js';
import { User } from './User.entity.js';
@Entity('tasks')
export class Task extends BaseEntity {
    @Column()
    title;
    @Column({ type: 'text' })
    description;
    @Column({
        type: 'enum',
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    })
    status;
    @Column({ type: 'jsonb', nullable: true })
    input;
    @Column({ type: 'jsonb', nullable: true })
    output;
    @Column({ type: 'jsonb', nullable: true })
    metadata;
    @ManyToOne(() => Agent)
    @JoinColumn({ name: 'agentId' })
    agent;
    @Column()
    agentId;
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user;
    @Column({ nullable: true })
    userId;
    @Column({ type: 'timestamp', nullable: true })
    startedAt;
    @Column({ type: 'timestamp', nullable: true })
    completedAt;
    @Column({ type: 'float', nullable: true })
    executionTimeMs;
    @Column({ type: 'text', nullable: true })
    errorMessage;
}
