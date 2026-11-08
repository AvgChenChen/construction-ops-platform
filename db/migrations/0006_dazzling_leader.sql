CREATE TABLE "browser_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"owner" text NOT NULL,
	"version" integer NOT NULL,
	"platform" text DEFAULT 'local' NOT NULL,
	"mode" text DEFAULT 'MOCK' NOT NULL,
	"state" text DEFAULT 'PREPARE_QUEUED' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"digest" text NOT NULL,
	"screenshot" text,
	"approved_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"error_code" text,
	"receipt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_browser_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_browser_receipt_application_id_unique" UNIQUE("application_id"),
	CONSTRAINT "local_browser_receipt_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "browser_run" ADD CONSTRAINT "browser_run_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_run" ADD CONSTRAINT "browser_run_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browser_run" ADD CONSTRAINT "browser_run_owner_agent_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_browser_receipt" ADD CONSTRAINT "local_browser_receipt_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_browser_receipt" ADD CONSTRAINT "local_browser_receipt_run_id_browser_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."browser_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_browser_run" ON "browser_run" USING btree ("application_id") WHERE state IN ('PREPARE_QUEUED','PREPARING','READY','SUBMIT_QUEUED','SUBMITTING','UNCERTAIN');