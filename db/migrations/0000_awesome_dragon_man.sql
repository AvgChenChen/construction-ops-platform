CREATE TYPE "public"."provenance" AS ENUM('MOCK', 'UNVERIFIED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."application_stage" AS ENUM('DISCOVERED', 'VERIFIED_ELIGIBLE', 'PREPARING_DOCUMENTS', 'AWAITING_QC', 'QC_APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'NEEDS_USER_REVIEW', 'SUBMISSION_UNCERTAIN', 'SUBMITTED_CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."task_state" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'UNCERTAIN');--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"instructions" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"mode" text DEFAULT 'MOCK' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"stage" "application_stage" DEFAULT 'DISCOVERED' NOT NULL,
	"outcome" text DEFAULT 'PENDING' NOT NULL,
	"executor_id" text,
	"current_version" integer DEFAULT 0 NOT NULL,
	"qc_version" integer,
	"approved_version" integer,
	"error_reason" text,
	"next_action" text,
	"imported" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_opportunity_id_unique" UNIQUE("opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "approval_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"kind" text NOT NULL,
	"version" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"original_deadline" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"school" text NOT NULL,
	"program" text NOT NULL,
	"year" integer NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networking_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"relationship" text NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_package" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_package_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"resume" text NOT NULL,
	"cover_letter" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"experience_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "employer_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "submission_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reference" text NOT NULL,
	"verified_by" text NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_evidence_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"original_date" text NOT NULL,
	"notes" text NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networking_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"application_id" uuid,
	"draft" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"approval_id" uuid,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"employer_id" uuid NOT NULL,
	"position" text NOT NULL,
	"requisition_id" text NOT NULL,
	"url" text NOT NULL,
	"term" text NOT NULL,
	"location" text DEFAULT 'Toronto' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"eligibility" text DEFAULT 'UNKNOWN' NOT NULL,
	"eligibility_evidence" text,
	"posting_date" timestamp with time zone,
	"deadline" timestamp with time zone,
	"deadline_original" text,
	"timezone" text DEFAULT 'America/Toronto' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_opportunity_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "quality_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reviewer" text NOT NULL,
	"passed" boolean NOT NULL,
	"checks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiting_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"body" text NOT NULL,
	"deadline_original" text,
	"timezone" text,
	"application_id" uuid,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"task_id" uuid,
	"executor_id" text NOT NULL,
	"previous_owner" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"task_id" uuid,
	"actor" text NOT NULL,
	"type" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid,
	"owner" text NOT NULL,
	"kind" text NOT NULL,
	"state" "task_state" DEFAULT 'QUEUED' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"error_reason" text,
	"next_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_opportunity_id_job_opportunity_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."job_opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_candidate_id_candidate_profile_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_executor_id_agent_id_fk" FOREIGN KEY ("executor_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_package" ADD CONSTRAINT "document_package_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_package_id_document_package_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."document_package"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience" ADD CONSTRAINT "experience_candidate_id_candidate_profile_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "networking_activity" ADD CONSTRAINT "networking_activity_contact_id_networking_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."networking_contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "networking_activity" ADD CONSTRAINT "networking_activity_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "networking_activity" ADD CONSTRAINT "networking_activity_approval_id_approval_request_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approval_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_opportunity" ADD CONSTRAINT "job_opportunity_employer_id_employer_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_review" ADD CONSTRAINT "quality_review_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_review" ADD CONSTRAINT "quality_review_reviewer_agent_id_fk" FOREIGN KEY ("reviewer") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiting_email" ADD CONSTRAINT "recruiting_email_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_executor_id_agent_id_fk" FOREIGN KEY ("executor_id") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_owner_agent_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stage_idx" ON "application" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "executor_idx" ON "application" USING btree ("executor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "package_version_unique" ON "document_version" USING btree ("package_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "requisition_unique" ON "job_opportunity" USING btree ("employer_id","requisition_id");--> statement-breakpoint
CREATE INDEX "deadline_idx" ON "job_opportunity" USING btree ("deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "email_unique" ON "recruiting_email" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "event_app_idx" ON "task_event" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "queue_idx" ON "task" USING btree ("state","available_at");