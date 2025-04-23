-- Temporarily simplify the RLS policy for inserting into locations for debugging

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create locations" ON public.locations;

-- Recreate the policy with a simplified check (only checks if user is authenticated)
CREATE POLICY "Authenticated users can create locations (DEBUG)"
  ON public.locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated'); -- Simplified check

-- Add a comment for clarity
COMMENT ON POLICY "Authenticated users can create locations (DEBUG)" ON public.locations IS 'DEBUGGING: Temporarily simplified policy to check only if the user role is authenticated.';
