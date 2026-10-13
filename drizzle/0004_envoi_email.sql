CREATE TABLE "local_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"receipt_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"sender_address" text NOT NULL,
	"sender_name" text NOT NULL,
	"reply_to_address" text NOT NULL,
	"reply_to_name" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"text_body" text NOT NULL,
	"attachment_file_name" text NOT NULL,
	"attachment_content_type" text NOT NULL,
	"attachment_content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_email_recipient_length" CHECK (char_length("local_email"."recipient") between 3 and 254),
	CONSTRAINT "local_email_headers_single_line" CHECK ("local_email"."subject" !~ '[\r\n]' and "local_email"."sender_name" !~ '[\r\n]' and "local_email"."reply_to_name" !~ '[\r\n]'),
	CONSTRAINT "local_email_attachment_content_type" CHECK ("local_email"."attachment_content_type" = 'application/pdf')
);
--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "email_send_state" text;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "email_send_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "email_sent_to" text;--> statement-breakpoint
-- L'unicité doit exister avant la clé étrangère qui la référence.
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_id_owner_id_unique" UNIQUE("id","owner_id");--> statement-breakpoint
ALTER TABLE "local_email" ADD CONSTRAINT "local_email_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_email" ADD CONSTRAINT "local_email_receipt_id_owner_id_receipt_fk" FOREIGN KEY ("receipt_id","owner_id") REFERENCES "public"."receipt"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "local_email_receipt_id_idx" ON "local_email" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "local_email_owner_id_idx" ON "local_email" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_email_send_state_values" CHECK ("receipt"."email_send_state" is null or "receipt"."email_send_state" in ('sending', 'failed'));--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_email_send_state_with_start" CHECK (("receipt"."email_send_state" is null) = ("receipt"."email_send_started_at" is null));--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_email_sent_at_with_address" CHECK (("receipt"."email_sent_at" is null) = ("receipt"."email_sent_to" is null));--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_email_sent_to_length" CHECK (char_length("receipt"."email_sent_to") between 3 and 254);