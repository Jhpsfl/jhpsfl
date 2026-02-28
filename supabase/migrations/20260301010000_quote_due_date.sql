-- Add due_date column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS due_date DATE;
