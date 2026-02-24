-- Add 'incomplete' to video_leads.status check constraint
-- Needed for the background-upload flow where a lead is created early
-- and finalized only when the user hits submit.

ALTER TABLE video_leads DROP CONSTRAINT IF EXISTS video_leads_status_check;

ALTER TABLE video_leads
  ADD CONSTRAINT video_leads_status_check
  CHECK (status IN ('incomplete', 'new', 'reviewing', 'quoted', 'accepted', 'converted', 'declined', 'expired'));
