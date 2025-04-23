-- Add address column to the locations table
ALTER TABLE public.locations
ADD COLUMN address TEXT;

-- Add comment to the new column for clarity
COMMENT ON COLUMN public.locations.address IS 'Stores the full address of the location.';
