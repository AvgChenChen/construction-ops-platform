ALTER TABLE agent_run DROP CONSTRAINT ai_mode;
--> statement-breakpoint
ALTER TABLE agent_run ADD CONSTRAINT ai_mode CHECK (mode IN ('MOCK','LOCAL','LIVE'));
