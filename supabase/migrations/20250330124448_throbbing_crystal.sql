/*
  # Add user_id and update schema
  
  1. Changes
    - Add user_id column to existing tables if missing
    - Update foreign key constraints
    - Update RLS policies
    - Add performance indexes
  
  2. Security
    - Maintain RLS on all tables
    - Update policies for user-based access
*/

-- Add user_id column to existing tables if it doesn't exist
DO $$
BEGIN
  -- Add user_id to locations if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'locations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE locations 
    ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid(),
    ADD CONSTRAINT locations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to reviews if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE reviews 
    ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid(),
    ADD CONSTRAINT reviews_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add user_id to favorites if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'favorites' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE favorites 
    ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid(),
    ADD CONSTRAINT favorites_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can create locations" ON locations;
DROP POLICY IF EXISTS "Users can update their own locations" ON locations;
DROP POLICY IF EXISTS "Users can delete their own locations" ON locations;

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;

DROP POLICY IF EXISTS "Users can view their own favorites" ON favorites;
DROP POLICY IF EXISTS "Authenticated users can create favorites" ON favorites;
DROP POLICY IF EXISTS "Users can delete their own favorites" ON favorites;

-- Create policies for locations
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

-- Create policies for reviews
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

-- Create policies for favorites
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS locations_user_id_idx ON locations(user_id);
CREATE INDEX IF NOT EXISTS reviews_location_id_idx ON reviews(location_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_location_id_idx ON favorites(location_id);