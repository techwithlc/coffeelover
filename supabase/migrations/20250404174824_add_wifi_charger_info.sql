-- Add columns for WiFi and charger information to the locations table

ALTER TABLE public.locations
ADD COLUMN has_wifi BOOLEAN DEFAULT FALSE,
ADD COLUMN has_chargers BOOLEAN DEFAULT FALSE,
ADD COLUMN charger_count INTEGER DEFAULT 0;

-- Add comments to the new columns for clarity
COMMENT ON COLUMN public.locations.has_wifi IS 'Indicates if the location offers WiFi access.';
COMMENT ON COLUMN public.locations.has_chargers IS 'Indicates if the location offers charging facilities.';
COMMENT ON COLUMN public.locations.charger_count IS 'Approximate number of chargers available.';
