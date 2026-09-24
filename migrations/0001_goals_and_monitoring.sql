CREATE TABLE "problem_completions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"problem_id" text NOT NULL,
	"due_date" text,
	"completed_at" timestamp NOT NULL,
	"on_time" boolean,
	CONSTRAINT "problem_completions_user_id_course_id_problem_id_unique" UNIQUE("user_id","course_id","problem_id")
);
--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "estimated_hours" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "learner_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "resumed_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slack_channel_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stagnation_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "problem_completions" ADD CONSTRAINT "problem_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_completions" ADD CONSTRAINT "problem_completions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_completions" ADD CONSTRAINT "problem_completions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;