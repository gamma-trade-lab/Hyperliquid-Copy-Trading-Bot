import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704672000000 implements MigrationInterface {
  name = 'InitialSchema1704672000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "preferences" jsonb,
        "metadata" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastLoginAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create agents table
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "type" character varying NOT NULL,
        "description" text NOT NULL,
        "capabilities" jsonb,
        "configuration" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastActiveAt" TIMESTAMP,
        "metrics" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_agents_name" UNIQUE ("name"),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id")
      )
    `);

    // Create tasks table
    await queryRunner.query(`
      CREATE TYPE "task_status_enum" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "status" "task_status_enum" NOT NULL DEFAULT 'PENDING',
        "input" jsonb,
        "output" jsonb,
        "metadata" jsonb,
        "agentId" uuid NOT NULL,
        "userId" uuid,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "executionTimeMs" double precision,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "tasks" 
      ADD CONSTRAINT "FK_tasks_agents" 
      FOREIGN KEY ("agentId") 
      REFERENCES "agents"("id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks" 
      ADD CONSTRAINT "FK_tasks_users" 
      FOREIGN KEY ("userId") 
      REFERENCES "users"("id") 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_status" ON "tasks"("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_agentId" ON "tasks"("agentId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_userId" ON "tasks"("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_createdAt" ON "tasks"("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_tasks_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_agentId"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_status"`);

    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_users"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_agents"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "task_status_enum"`);
    await queryRunner.query(`DROP TABLE "agents"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
} 