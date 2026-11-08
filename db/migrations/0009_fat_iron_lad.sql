CREATE TABLE "mills_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PROSPECT' NOT NULL,
	"call_date" timestamp with time zone,
	"pain" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"next_step" text DEFAULT 'Send interview request' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mills_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mills_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source_task_id" uuid NOT NULL,
	"recipient_trade_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provenance" "provenance" DEFAULT 'MOCK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mills_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"trade_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" timestamp with time zone,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'ON_TRACK' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mills_trade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"trade" text NOT NULL,
	"company" text NOT NULL,
	"contact" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'ON_TRACK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mills_message" ADD CONSTRAINT "mills_message_job_id_mills_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."mills_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mills_message" ADD CONSTRAINT "mills_message_source_task_id_mills_task_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."mills_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mills_task" ADD CONSTRAINT "mills_task_job_id_mills_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."mills_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mills_task" ADD CONSTRAINT "mills_task_trade_id_mills_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."mills_trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mills_trade" ADD CONSTRAINT "mills_trade_job_id_mills_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."mills_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mills_contact_status_idx" ON "mills_contact" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mills_job_status_idx" ON "mills_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mills_task_job_idx" ON "mills_task" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "mills_task_trade_idx" ON "mills_task" USING btree ("trade_id");--> statement-breakpoint
CREATE INDEX "mills_trade_job_idx" ON "mills_trade" USING btree ("job_id");