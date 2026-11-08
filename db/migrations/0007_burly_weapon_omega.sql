CREATE TABLE "auth_session" (
	"hash" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"mode" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_throttle" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"sha256" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_state" (
	"hash" text PRIMARY KEY NOT NULL,
	"binding_hash" text NOT NULL,
	"verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeat" (
	"id" text PRIMARY KEY NOT NULL,
	"loop" text NOT NULL,
	"status" text NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_success" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
