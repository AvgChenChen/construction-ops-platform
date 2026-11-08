ALTER TABLE agent_run ADD COLUMN task_id uuid REFERENCES task(id);
--> statement-breakpoint
ALTER TABLE agent_run ADD COLUMN mode text NOT NULL DEFAULT 'MOCK';
--> statement-breakpoint
ALTER TABLE agent_run ADD COLUMN model text;
--> statement-breakpoint
ALTER TABLE agent_run ADD COLUMN usage jsonb;
--> statement-breakpoint
CREATE INDEX agent_run_task_idx ON agent_run(task_id,created_at);
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_ai_run ON agent_run(task_id) WHERE status='RUNNING';
--> statement-breakpoint
ALTER TABLE agent_run ADD CONSTRAINT ai_mode CHECK (mode IN ('MOCK','LIVE'));
