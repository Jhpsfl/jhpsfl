-- Create push_subscriptions table for storing browser push notification subscriptions
CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (allow authenticated users to read their own)
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid()::text = clerk_user_id);

-- Create index on clerk_user_id for efficient lookups
CREATE INDEX idx_push_subscriptions_clerk_user_id
  ON push_subscriptions(clerk_user_id);
