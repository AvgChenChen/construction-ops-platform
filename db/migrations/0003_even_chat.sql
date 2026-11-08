CREATE TABLE "integration_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"mode" text DEFAULT 'MOCK' NOT NULL,
	"status" text DEFAULT 'CONNECTED' NOT NULL,
	"identity" text,
	"credentials" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_state" (
	"hash" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"session_hash" text NOT NULL,
	"verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"slot" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"error_code" text,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"interval_minutes" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_item" ADD CONSTRAINT "integration_item_schedule_id_sync_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."sync_schedule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_state" ADD CONSTRAINT "oauth_state_account_id_integration_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."integration_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_job" ADD CONSTRAINT "sync_job_schedule_id_sync_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."sync_schedule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_schedule" ADD CONSTRAINT "sync_schedule_account_id_integration_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."integration_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_item_unique" ON "integration_item" USING btree ("schedule_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_slot_unique" ON "sync_job" USING btree ("schedule_id","slot");--> statement-breakpoint
CREATE INDEX "sync_queue_idx" ON "sync_job" USING btree ("state","available_at");