CREATE TABLE "rental" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"address" text NOT NULL,
	"address_complement" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"tenant_name" text NOT NULL,
	"tenant_email" text NOT NULL,
	"rent_in_cents" integer NOT NULL,
	"charges_in_cents" integer NOT NULL,
	"due_day" smallint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_address_length" CHECK (char_length("rental"."address") between 1 and 200),
	CONSTRAINT "rental_address_complement_length" CHECK (char_length("rental"."address_complement") between 1 and 100),
	CONSTRAINT "rental_postal_code_format" CHECK ("rental"."postal_code" ~ '^[0-9]{5}$'),
	CONSTRAINT "rental_city_length" CHECK (char_length("rental"."city") between 1 and 100),
	CONSTRAINT "rental_tenant_name_length" CHECK (char_length("rental"."tenant_name") between 1 and 100),
	CONSTRAINT "rental_tenant_email_normalized" CHECK ("rental"."tenant_email" = lower(btrim("rental"."tenant_email")) and char_length("rental"."tenant_email") between 3 and 254),
	CONSTRAINT "rental_rent_in_cents_range" CHECK ("rental"."rent_in_cents" between 1 and 9999999),
	CONSTRAINT "rental_charges_in_cents_range" CHECK ("rental"."charges_in_cents" between 0 and 9999999),
	CONSTRAINT "rental_due_day_range" CHECK ("rental"."due_day" between 1 and 31),
	CONSTRAINT "rental_start_date_range" CHECK ("rental"."start_date" between '1950-01-01' and '2099-12-31'),
	CONSTRAINT "rental_end_date_range" CHECK ("rental"."end_date" between '1950-01-01' and '2099-12-31'),
	CONSTRAINT "rental_end_date_not_before_start_date" CHECK ("rental"."end_date" >= "rental"."start_date")
);
--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rental_owner_id_created_at_idx" ON "rental" USING btree ("owner_id","created_at");