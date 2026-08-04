-- =========================================================
-- CRM Lite — Production Supabase Schema
-- Includes "Organization", object_type_definitions, field_definitions,
-- roles, users, and universal_table
-- =========================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- 1. ORGANIZATION TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Organization" (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_name text NOT NULL,
  organization_code text NOT NULL,
  subscription_plan text NOT NULL DEFAULT 'trial'::text,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_organization_code_key UNIQUE (organization_code),
  CONSTRAINT companies_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'suspended'::text, 'cancelled'::text])
  ),
  CONSTRAINT companies_subscription_plan_check CHECK (
    subscription_plan = ANY (ARRAY['trial'::text, 'basic'::text, 'pro'::text, 'enterprise'::text])
  )
) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 2. OBJECT TYPE DEFINITIONS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.object_type_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NULL,
  api_name text NOT NULL,
  display_name text NOT NULL,
  description text NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT object_type_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT object_type_definitions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES "Organization" (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_object_type_definitions_organization_api 
  ON public.object_type_definitions USING btree (organization_id, api_name) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 3. FIELD DEFINITIONS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_definitions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NULL,
  object_type_id uuid NOT NULL,
  api_name text NOT NULL,
  display_name text NOT NULL,
  field_type text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  default_value text NULL,
  searchable boolean NOT NULL DEFAULT false,
  filterable boolean NOT NULL DEFAULT false,
  sortable boolean NOT NULL DEFAULT false,
  "unique" boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lookup_target_object_type_id uuid NULL,
  CONSTRAINT field_definitions_pkey PRIMARY KEY (id),
  CONSTRAINT field_definitions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES "Organization" (id) ON DELETE CASCADE,
  CONSTRAINT field_definitions_lookup_target_object_type_id_fkey FOREIGN KEY (lookup_target_object_type_id) REFERENCES object_type_definitions (id),
  CONSTRAINT field_definitions_object_type_id_fkey FOREIGN KEY (object_type_id) REFERENCES object_type_definitions (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_definitions_object_api 
  ON public.field_definitions USING btree (object_type_id, api_name) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 4. ROLES TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  role_name text NOT NULL,
  description text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES "Organization" (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 5. USERS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  role_id uuid NULL,
  status text NOT NULL DEFAULT 'active'::text,
  password_hash text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES "Organization" (id) ON DELETE CASCADE,
  CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT users_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'invited'::text, 'disabled'::text])
  )
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_organization_email 
  ON public.users USING btree (organization_id, lower(email)) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 6. UNIVERSAL TABLE (Storage Engine for Records)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universal_table (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  object_type_id uuid NOT NULL,
  name text NULL,
  status text NULL,
  owner_id uuid NULL,
  parent_id uuid NULL,
  secondary_parent_id uuid NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  CONSTRAINT objects_pkey PRIMARY KEY (id),
  CONSTRAINT objects_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT objects_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users (id),
  CONSTRAINT objects_object_type_id_fkey FOREIGN KEY (object_type_id) REFERENCES object_type_definitions (id),
  CONSTRAINT objects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users (id),
  CONSTRAINT objects_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES universal_table (id),
  CONSTRAINT objects_secondary_parent_id_fkey FOREIGN KEY (secondary_parent_id) REFERENCES universal_table (id),
  CONSTRAINT objects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES "Organization" (id) ON DELETE CASCADE,
  CONSTRAINT objects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users (id)
-- ---------------------------------------------------------
-- 7. VALIDATION RULES TABLE (Multi-Tenant)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.validation_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  object_name text NOT NULL,
  rule_name text NOT NULL,
  error_message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  field_name text NULL,
  rule_type text NULL,
  rule_value text NULL,
  created_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT validation_rules_pkey PRIMARY KEY (id),
  CONSTRAINT validation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES "Organization" (id) ON DELETE CASCADE,
  CONSTRAINT validation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT validation_rules_rule_type_check CHECK (
    (
      rule_type = ANY (
        ARRAY[
          'required'::text,
          'min_length'::text,
          'max_length'::text,
          'min_value'::text,
          'max_value'::text,
          'regex'::text,
          'allowed_values'::text,
          'date_future'::text,
          'date_past'::text,
          'date_range'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_validation_rules_org_object_active 
  ON public.validation_rules USING btree (organization_id, object_name, is_active) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 8. OBJECT PERMISSIONS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.object_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  role_id uuid NOT NULL,
  object_type_id uuid NOT NULL,
  can_create boolean NOT NULL DEFAULT true,
  can_read boolean NOT NULL DEFAULT true,
  can_update boolean NOT NULL DEFAULT true,
  can_delete boolean NOT NULL DEFAULT true,
  view_all boolean NOT NULL DEFAULT false,
  modify_all boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT object_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT object_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT object_permissions_object_type_id_fkey FOREIGN KEY (object_type_id) REFERENCES object_type_definitions (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_object_permissions_role_object 
  ON public.object_permissions USING btree (role_id, object_type_id) TABLESPACE pg_default;

-- ---------------------------------------------------------
-- 9. FIELD PERMISSIONS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  role_id uuid NOT NULL,
  field_id uuid NOT NULL,
  can_read boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT true,
  can_update boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT field_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT field_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT field_permissions_field_id_fkey FOREIGN KEY (field_id) REFERENCES field_definitions (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_permissions_role_field 
  ON public.field_permissions USING btree (role_id, field_id) TABLESPACE pg_default;

-- =========================================================
-- SEED DATA SETUP
-- Demo Password: Password123!
-- =========================================================

-- Seed Demo Organization
INSERT INTO public."Organization" (id, organization_name, organization_code, subscription_plan, status)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Acme Corporation',
  'ACME01',
  'enterprise',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Seed Standard Enterprise Roles
INSERT INTO public.roles (id, organization_id, role_name, description)
VALUES
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Administrator', 'Full administrative access to all CRM features.'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a34', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CRM Manager', 'Full management access to sales and customer operations.'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a35', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Relationship Manager', 'Access to manage client relationships, deals, and communication.'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a36', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CRM Executive', 'Standard operational access to leads, accounts, and tasks.'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a37', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Read Only User', 'Read-only access across all standard CRM objects and reports.')
ON CONFLICT (id) DO NOTHING;

-- Seed Admin User (priya@acme.com / Password123!)
INSERT INTO public.users (id, organization_id, first_name, last_name, email, role_id, password_hash, status)
VALUES (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Priya',
  'Rao',
  'priya@acme.com',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  '$2a$10$7R.qZ8v/jZg0T7BwZqVz9.kF34D1W3mQ.H9wN2L5J2H3k4L5M6N7O',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- Seed Object Type Definitions (Leads, Deals, Contacts, Companies)
INSERT INTO public.object_type_definitions (id, organization_id, api_name, display_name, is_system)
VALUES
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'leads', 'Leads', true),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'deals', 'Deals', true),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'contacts', 'Contacts', true),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'companies', 'Companies', true)
ON CONFLICT (id) DO NOTHING;

-- Seed Field Definitions for Leads, Deals, Contacts, Companies
INSERT INTO public.field_definitions (organization_id, object_type_id, api_name, display_name, field_type, required)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'name', 'Lead Name', 'text', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'email', 'Email Address', 'email', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'company', 'Company Name', 'text', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'status', 'Lead Status', 'dropdown', true),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'name', 'Deal Name', 'text', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'company_id', 'Company / Account', 'lookup', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'contact_id', 'Primary Contact', 'lookup', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'amount', 'Amount', 'number', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42', 'stage', 'Stage', 'dropdown', true),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'name', 'Contact Name', 'text', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'email', 'Email', 'email', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'phone', 'Phone', 'phone', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43', 'company_id', 'Company / Account', 'lookup', false),

  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'name', 'Company Name', 'text', true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'industry', 'Industry', 'text', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'website', 'Website', 'url', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'phone', 'Phone', 'phone', false)
ON CONFLICT DO NOTHING;

-- Seed Sample Records in universal_table for Leads
INSERT INTO public.universal_table (organization_id, object_type_id, name, status, data)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'Sarah Jenkins', 'Qualified', '{"email": "sarah@techcorp.io", "company": "TechCorp Systems"}'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41', 'Michael Chang', 'Contacted', '{"email": "m.chang@innovate.co", "company": "Innovate LLC"}');

