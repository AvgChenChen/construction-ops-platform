CREATE TABLE "mills_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mills_account_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mills_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"role" text DEFAULT 'OPS' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mills_trade_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"trade_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"role" text DEFAULT 'CONTRACTOR' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mills_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"job_id" uuid,
	"trade_id" uuid,
	"action" text NOT NULL,
	"before_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "mills_account" ("id","name","slug","status") VALUES (gen_random_uuid(),'Mills local workspace','mills-local','ACTIVE') ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "mills_job" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
UPDATE "mills_job" SET "account_id"=(SELECT "id" FROM "mills_account" WHERE "slug"='mills-local' LIMIT 1) WHERE "account_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "mills_job" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "mills_contact" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
UPDATE "mills_contact" SET "account_id"=(SELECT "id" FROM "mills_account" WHERE "slug"='mills-local' LIMIT 1) WHERE "account_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "mills_contact" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "mills_membership" ADD CONSTRAINT "mills_membership_account_id_mills_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."mills_account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_trade_membership" ADD CONSTRAINT "mills_trade_membership_account_id_mills_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."mills_account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_trade_membership" ADD CONSTRAINT "mills_trade_membership_job_id_mills_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."mills_job"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_trade_membership" ADD CONSTRAINT "mills_trade_membership_trade_id_mills_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."mills_trade"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_job" ADD CONSTRAINT "mills_job_account_id_mills_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."mills_account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_contact" ADD CONSTRAINT "mills_contact_account_id_mills_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."mills_account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_audit_event" ADD CONSTRAINT "mills_audit_event_account_id_mills_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."mills_account"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_audit_event" ADD CONSTRAINT "mills_audit_event_job_id_mills_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."mills_job"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_audit_event" ADD CONSTRAINT "mills_audit_event_trade_id_mills_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."mills_trade"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "mills_account_status_idx" ON "mills_account" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "mills_membership_account_actor_unique" ON "mills_membership" USING btree ("account_id","actor_id");
--> statement-breakpoint
CREATE INDEX "mills_membership_actor_idx" ON "mills_membership" USING btree ("actor_id");
--> statement-breakpoint
WITH ranked_jobs AS (
	SELECT j.id,
		row_number() OVER (
			PARTITION BY j.account_id, j.name
			ORDER BY (SELECT count(*) FROM "mills_message" m WHERE m.job_id = j.id) DESC, j.created_at ASC, j.id
		) AS duplicate_rank
	FROM "mills_job" j
)
UPDATE "mills_job" j
SET "name" = j."name" || ' (legacy ' || left(j."id"::text, 8) || ')'
FROM ranked_jobs r
WHERE j."id" = r."id" AND r.duplicate_rank > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "mills_job_account_name_unique" ON "mills_job" USING btree ("account_id","name");
--> statement-breakpoint
CREATE INDEX "mills_job_account_idx" ON "mills_job" USING btree ("account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mills_trade_membership_actor_trade_unique" ON "mills_trade_membership" USING btree ("actor_id","trade_id");
--> statement-breakpoint
CREATE INDEX "mills_trade_membership_actor_idx" ON "mills_trade_membership" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX "mills_trade_membership_job_idx" ON "mills_trade_membership" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "mills_contact_account_idx" ON "mills_contact" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX "mills_audit_account_idx" ON "mills_audit_event" USING btree ("account_id","created_at");
--> statement-breakpoint
CREATE INDEX "mills_audit_job_idx" ON "mills_audit_event" USING btree ("job_id","created_at");
--> statement-breakpoint
CREATE INDEX "mills_audit_actor_idx" ON "mills_audit_event" USING btree ("actor_id","created_at");
