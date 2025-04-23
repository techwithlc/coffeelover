-- Restore the original RLS policy for inserting into the locations table

-- Drop the temporary debugging policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create locations (DEBUG)" ON public.locations;

-- Recreate the original, more secure policy
CREATE POLICY "Authenticated users can create locations"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id); -- Restore original check

-- Add a comment for clarity
COMMENT ON POLICY "Authenticated users can create locations" ON public.locations IS 'Ensures that only the authenticated user can insert locations linked to their own user ID.';
