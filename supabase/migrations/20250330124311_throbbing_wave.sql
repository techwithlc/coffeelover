/*
  # Initial Schema Setup for Location-based Application

  1. New Tables (if not exist)
    - `locations`
    - `reviews`
    - `favorites`

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create tables if they don't exist
DO $$ 
BEGIN
  -- Create locations table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'locations') THEN
    CREATE TABLE locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lat double precision NOT NULL,
      lng double precision NOT NULL,
      name text NOT NULL,
      created_at timestamptz DEFAULT now(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
    );
  END IF;

  -- Create reviews table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'reviews') THEN
    CREATE TABLE reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment text,
      created_at timestamptz DEFAULT now()
    );
  END IF;

  -- Create favorites table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'favorites') THEN
    CREATE TABLE favorites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      UNIQUE(user_id, location_id)
    );
  END IF;
END $$;

-- Enable Row Level Security (safe to run multiple times)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  -- Locations policies
  DROP POLICY IF EXISTS "Anyone can view locations" ON locations;
  DROP POLICY IF EXISTS "Authenticated users can create locations" ON locations;
  DROP POLICY IF EXISTS "Users can update their own locations" ON locations;
  DROP POLICY IF EXISTS "Users can delete their own locations" ON locations;

  -- Reviews policies
  DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
  DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
  DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
  DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;

  -- Favorites policies
  DROP POLICY IF EXISTS "Users can view their own favorites" ON favorites;
  DROP POLICY IF EXISTS "Authenticated users can create favorites" ON favorites;
  DROP POLICY IF EXISTS "Users can delete their own favorites" ON favorites;
END $$;

-- Recreate policies for locations
CREATE POLICY "Anyone can view locations"
  ON locations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create locations"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations"
  ON locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations"
  ON locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Recreate policies for reviews
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Recreate policies for favorites
CREATE POLICY "Users can view their own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create favorites"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'locations_user_id_idx') THEN
    CREATE INDEX locations_user_id_idx ON locations(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reviews_location_id_idx') THEN
    CREATE INDEX reviews_location_id_idx ON reviews(location_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reviews_user_id_idx') THEN
    CREATE INDEX reviews_user_id_idx ON reviews(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'favorites_user_id_idx') THEN
    CREATE INDEX favorites_user_id_idx ON favorites(user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'favorites_location_id_idx') THEN
    CREATE INDEX favorites_location_id_idx ON favorites(location_id);
  END IF;
END $$;