import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
@Entity('agents')
export class Agent extends BaseEntity {
    @Column({ unique: true })
    name;
    @Column()
    type;
    @Column({ type: 'text' })
    description;
    @Column({ type: 'jsonb', nullable: true })
    capabilities;
    @Column({ type: 'jsonb', nullable: true })
    configuration;
    @Column({ default: true })
    isActive;
    @Column({ type: 'timestamp', nullable: true })
    lastActiveAt;
    @Column({ type: 'jsonb', nullable: true })
    metrics;
}
