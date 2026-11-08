ALTER TABLE application ADD CONSTRAINT executor_role_only CHECK (executor_id IS NULL OR executor_id IN ('04','04B','04C'));
--> statement-breakpoint
ALTER TABLE application ADD CONSTRAINT approval_version_current CHECK (approved_version IS NULL OR approved_version=current_version);
--> statement-breakpoint
ALTER TABLE application ADD CONSTRAINT qc_version_current CHECK (qc_version IS NULL OR qc_version=current_version);
--> statement-breakpoint
CREATE UNIQUE INDEX one_live_execution_per_application ON task(application_id) WHERE kind='EXECUTE' AND state IN ('QUEUED','RUNNING','UNCERTAIN');
--> statement-breakpoint
ALTER TABLE job_opportunity ADD CONSTRAINT priority_range CHECK (priority BETWEEN 1 AND 3);
