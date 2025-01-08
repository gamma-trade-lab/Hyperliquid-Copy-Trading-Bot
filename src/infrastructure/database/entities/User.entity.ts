import { Entity, Column } from 'typeorm';
import { BaseEntity } from './BaseEntity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  username!: string;

  @Column()
  email!: string;

  @Column({ select: false })
  password!: string;

  @Column({ type: 'jsonb', nullable: true })
  preferences!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any>;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt!: Date;
}    