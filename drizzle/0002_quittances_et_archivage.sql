CREATE TABLE "landlord" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"address_complement" text,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landlord_name_length" CHECK (char_length("landlord"."name") between 1 and 100),
	CONSTRAINT "landlord_address_length" CHECK (char_length("landlord"."address") between 1 and 200),
	CONSTRAINT "landlord_address_complement_length" CHECK (char_length("landlord"."address_complement") between 1 and 100),
	CONSTRAINT "landlord_postal_code_format" CHECK ("landlord"."postal_code" ~ '^[0-9]{5}$'),
	CONSTRAINT "landlord_city_length" CHECK (char_length("landlord"."city") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"rental_id" uuid NOT NULL,
	"month" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"landlord_name" text NOT NULL,
	"landlord_address" text NOT NULL,
	"landlord_address_complement" text,
	"landlord_postal_code" text NOT NULL,
	"landlord_city" text NOT NULL,
	"tenant_name" text NOT NULL,
	"rental_address" text NOT NULL,
	"rental_address_complement" text,
	"rental_postal_code" text NOT NULL,
	"rental_city" text NOT NULL,
	"rent_in_cents" integer NOT NULL,
	"charges_in_cents" integer NOT NULL,
	"payment_date" date NOT NULL,
	"issue_date" date NOT NULL,
	"produced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipt_rental_id_month_unique" UNIQUE("rental_id","month"),
	CONSTRAINT "receipt_month_format" CHECK ("receipt"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "receipt_period_end_not_before_start" CHECK ("receipt"."period_end" >= "receipt"."period_start"),
	CONSTRAINT "receipt_period_within_month" CHECK (to_char("receipt"."period_start", 'YYYY-MM') = "receipt"."month" and to_char("receipt"."period_end", 'YYYY-MM') = "receipt"."month"),
	CONSTRAINT "receipt_payment_date_not_after_issue_date" CHECK ("receipt"."payment_date" <= "receipt"."issue_date"),
	CONSTRAINT "receipt_payment_date_range" CHECK ("receipt"."payment_date" between '1950-01-01' and '2099-12-31'),
	CONSTRAINT "receipt_rent_in_cents_range" CHECK ("receipt"."rent_in_cents" between 1 and 9999999),
	CONSTRAINT "receipt_charges_in_cents_range" CHECK ("receipt"."charges_in_cents" between 0 and 9999999),
	CONSTRAINT "receipt_landlord_name_length" CHECK (char_length("receipt"."landlord_name") between 1 and 100),
	CONSTRAINT "receipt_landlord_address_length" CHECK (char_length("receipt"."landlord_address") between 1 and 200),
	CONSTRAINT "receipt_landlord_address_complement_length" CHECK (char_length("receipt"."landlord_address_complement") between 1 and 100),
	CONSTRAINT "receipt_landlord_postal_code_format" CHECK ("receipt"."landlord_postal_code" ~ '^[0-9]{5}$'),
	CONSTRAINT "receipt_landlord_city_length" CHECK (char_length("receipt"."landlord_city") between 1 and 100),
	CONSTRAINT "receipt_tenant_name_length" CHECK (char_length("receipt"."tenant_name") between 1 and 100),
	CONSTRAINT "receipt_rental_address_length" CHECK (char_length("receipt"."rental_address") between 1 and 200),
	CONSTRAINT "receipt_rental_address_complement_length" CHECK (char_length("receipt"."rental_address_complement") between 1 and 100),
	CONSTRAINT "receipt_rental_postal_code_format" CHECK ("receipt"."rental_postal_code" ~ '^[0-9]{5}$'),
	CONSTRAINT "receipt_rental_city_length" CHECK (char_length("receipt"."rental_city") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "rental" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "landlord" ADD CONSTRAINT "landlord_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Ordre corrigé à la main : drizzle-kit plaçait cette unicité après la clé
-- étrangère qui en a besoin (receipt_rental_id_owner_id_rental_fk), que
-- Postgres aurait alors refusé de créer.
ALTER TABLE "rental" ADD CONSTRAINT "rental_id_owner_id_unique" UNIQUE("id","owner_id");--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_rental_id_owner_id_rental_fk" FOREIGN KEY ("rental_id","owner_id") REFERENCES "public"."rental"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipt_owner_id_idx" ON "receipt" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "rental" ADD CONSTRAINT "rental_archived_only_if_ended" CHECK ("rental"."archived_at" is null or ("rental"."end_date" is not null and "rental"."end_date" < ("rental"."archived_at" at time zone 'Europe/Paris')::date));