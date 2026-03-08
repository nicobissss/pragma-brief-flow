-- Create call status enum
CREATE TYPE public.call_status AS ENUM ('not_scheduled', 'scheduled', 'done_positive', 'done_negative', 'no_show');

-- Add sales call fields to prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS call_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_status call_status NOT NULL DEFAULT 'not_scheduled',
  ADD COLUMN IF NOT EXISTS call_notes text,
  ADD COLUMN IF NOT EXISTS follow_up_date date;