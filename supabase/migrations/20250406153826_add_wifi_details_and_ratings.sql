-- Migration: Add tables for detailed Wi-Fi information and user experience ratings

-- Table to store user-submitted Wi-Fi details for locations
CREATE TABLE public.location_wifi_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- User who submitted the info
    ssid TEXT,
    password TEXT, -- SECURITY WARNING: Storing passwords in plain text is insecure. Consider encryption or alternative approaches.
    wifi_type TEXT CHECK (wifi_type IN ('public', 'private', 'ask_staff')) DEFAULT 'ask_staff',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.location_wifi_details IS 'Stores user-submitted Wi-Fi network details (SSID, password, type) for specific locations.';
COMMENT ON COLUMN public.location_wifi_details.password IS 'Stores the Wi-Fi password. SECURITY WARNING: Plain text storage is insecure.';
COMMENT ON COLUMN public.location_wifi_details.wifi_type IS 'Type of Wi-Fi access: public (no password), private (password needed), ask_staff (need to ask).';

-- Add index for faster lookups by location
CREATE INDEX idx_location_wifi_details_location_id ON public.location_wifi_details(location_id);


-- Table to store user ratings for locations
CREATE TABLE public.location_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User who submitted the rating
    coffee_rating SMALLINT CHECK (coffee_rating >= 1 AND coffee_rating <= 5),
    wifi_rating SMALLINT CHECK (wifi_rating >= 1 AND wifi_rating <= 5),
    staff_rating SMALLINT CHECK (staff_rating >= 1 AND staff_rating <= 5), -- Optional rating
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.location_ratings IS 'Stores user experience ratings (coffee, Wi-Fi, staff) for specific locations.';
COMMENT ON COLUMN public.location_ratings.coffee_rating IS 'User rating for coffee quality (1-5).';
COMMENT ON COLUMN public.location_ratings.wifi_rating IS 'User rating for Wi-Fi speed and stability (1-5).';
COMMENT ON COLUMN public.location_ratings.staff_rating IS 'Optional user rating for staff attractiveness (1-5).';

-- Add index for faster lookups by location
CREATE INDEX idx_location_ratings_location_id ON public.location_ratings(location_id);

-- Optional: Add index for user-specific lookups
CREATE INDEX idx_location_ratings_user_id ON public.location_ratings(user_id);

-- Optional: Add unique constraint if only one rating per user per location is desired initially
-- ALTER TABLE public.location_ratings ADD CONSTRAINT unique_user_location_rating UNIQUE (user_id, location_id);
