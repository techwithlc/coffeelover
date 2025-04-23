-- Add rating column to the locations table
ALTER TABLE public.locations
ADD COLUMN rating FLOAT;

-- Add comment to the new column for clarity
COMMENT ON COLUMN public.locations.rating IS 'Stores the overall rating of the location (e.g., from Google Places).';
