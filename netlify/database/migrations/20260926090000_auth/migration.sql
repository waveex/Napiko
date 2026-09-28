-- OXY · migracja 1: tabele logowania i organizacji (Better Auth)
-- Źródło: server/db/schema/auth.ts (wygenerowane przez CLI Better Auth, kolumny czasu jako timestamptz).

CREATE TABLE "user" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE ("email")
);

CREATE TABLE "session" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "active_organization_id" text,
  CONSTRAINT "session_token_unique" UNIQUE ("token")
);
CREATE INDEX "session_userId_idx" ON "session" ("user_id");

CREATE TABLE "account" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
CREATE INDEX "account_userId_idx" ON "account" ("user_id");

CREATE TABLE "verification" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE "organization" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "created_at" timestamp with time zone NOT NULL,
  "metadata" text,
  -- "workshop" (warsztat) albo "solo" (samodzielny mechanik)
  "kind" text DEFAULT 'workshop',
  CONSTRAINT "organization_slug_unique" UNIQUE ("slug"),
  CONSTRAINT "organization_kind_check" CHECK ("kind" IS NULL OR "kind" IN ('workshop', 'solo'))
);

CREATE TABLE "member" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organization" ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
CREATE INDEX "member_organizationId_idx" ON "member" ("organization_id");
CREATE INDEX "member_userId_idx" ON "member" ("user_id");
-- Jedno członkostwo na parę (organizacja, użytkownik); indeks obsługuje też sprawdzanie członkostwa w politykach RLS.
CREATE UNIQUE INDEX "member_org_user_uq" ON "member" ("organization_id", "user_id");

CREATE TABLE "invitation" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organization" ("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "inviter_id" uuid NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE INDEX "invitation_organizationId_idx" ON "invitation" ("organization_id");
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");

CREATE TABLE "rate_limit" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "count" integer NOT NULL,
  "last_request" bigint NOT NULL,
  CONSTRAINT "rate_limit_key_unique" UNIQUE ("key")
);
