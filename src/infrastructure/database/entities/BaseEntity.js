import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
export class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id;
    @CreateDateColumn()
    createdAt;
    @UpdateDateColumn()
    updatedAt;
}
