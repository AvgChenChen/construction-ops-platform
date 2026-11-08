CREATE UNIQUE INDEX "mills_job_id_account_unique" ON "mills_job" USING btree ("id","account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "mills_trade_id_job_unique" ON "mills_trade" USING btree ("id","job_id");
--> statement-breakpoint
ALTER TABLE "mills_trade_membership" ADD CONSTRAINT "mills_trade_membership_account_job_fk" FOREIGN KEY ("job_id","account_id") REFERENCES "public"."mills_job"("id","account_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mills_trade_membership" ADD CONSTRAINT "mills_trade_membership_trade_job_fk" FOREIGN KEY ("trade_id","job_id") REFERENCES "public"."mills_trade"("id","job_id") ON DELETE cascade ON UPDATE no action;
