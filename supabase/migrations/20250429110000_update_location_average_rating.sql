-- Migration: Compute and maintain average coffee rating per location

-- Function to update the average rating inside the `locations` table whenever
-- the `location_ratings` table is mutated. At the moment we take the arithmetic
-- mean **only of the `coffee_rating` column** – feel free to adapt the formula
-- later if you would like to combine the Wi-Fi / staff scores as well.

CREATE OR REPLACE FUNCTION public.update_location_average_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_avg NUMERIC;
BEGIN
    -- Calculate the new average coffee rating for this location
    SELECT AVG(coffee_rating)::NUMERIC(10,2)
      INTO v_avg
      FROM public.location_ratings
     WHERE location_id = NEW.location_id;

    -- Persist it in the main locations table
    UPDATE public.locations
       SET rating = v_avg
     WHERE id = NEW.location_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the function owner has adequate privileges when RLS is enabled
ALTER FUNCTION public.update_location_average_rating()
  OWNER TO postgres;

-- Drop the trigger first if it already exists (for idempotency when re-running migrations)
DROP TRIGGER IF EXISTS trg_update_location_average_rating ON public.location_ratings;

-- Fire the trigger after INSERT, UPDATE and DELETE so that the cached average
-- stays correct at all times.
CREATE TRIGGER trg_update_location_average_rating
AFTER INSERT OR UPDATE OR DELETE ON public.location_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_location_average_rating();
