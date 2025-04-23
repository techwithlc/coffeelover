-- Reaffirm the RLS policy for inserting into the locations table

-- Drop the existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;

-- Recreate the policy to ensure it's correctly applied
CREATE POLICY "Authenticated users can create locations"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add a comment for clarity
COMMENT ON POLICY "Authenticated users can create locations" ON public.locations IS 'Ensures that only the authenticated user can insert locations linked to their own user ID.';
