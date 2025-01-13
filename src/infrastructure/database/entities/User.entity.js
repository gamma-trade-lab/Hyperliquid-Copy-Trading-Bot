import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
@Entity('users')
export class User extends BaseEntity {
    @Column({ unique: true })
    username;
    @Column()
    email;
    @Column({ select: false })
    password;
    @Column({ type: 'jsonb', nullable: true })
    preferences;
    @Column({ type: 'jsonb', nullable: true })
    metadata;
    @Column({ default: true })
    isActive;
    @Column({ type: 'timestamp', nullable: true })
    lastLoginAt;
}
