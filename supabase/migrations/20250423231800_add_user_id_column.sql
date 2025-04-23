-- Add user_id column to the locations table if it doesn't exist
-- This ensures idempotency in case the column was somehow added manually
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.locations 
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Add comment to the new column for clarity
    COMMENT ON COLUMN public.locations.user_id IS 'Foreign key referencing the user who created the location.';

    -- Add index for performance
    CREATE INDEX IF NOT EXISTS locations_user_id_idx ON public.locations(user_id);
  END IF;
END $$;
