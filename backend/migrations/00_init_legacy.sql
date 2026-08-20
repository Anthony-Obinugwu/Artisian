-- Enable PostGIS extension for geospatial features
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

-- Create vulcanizers table
CREATE TABLE IF NOT EXISTS public.vulcanizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL,
    owner_name TEXT,
    phone TEXT,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    address TEXT,
    is_open BOOLEAN DEFAULT true,
    verified BOOLEAN DEFAULT false,
    opening_time TIME,
    closing_time TIME,
    rating FLOAT DEFAULT 0.0,
    -- Store services as a JSON array of strings or IDs. We'll use text array for simplicity in MVP.
    services TEXT[] DEFAULT '{}',
    -- PostGIS geography point (longitude, latitude) - SRID 4326 is standard GPS coordinates
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED
);

-- Create spatial index for fast geographic queries
CREATE INDEX IF NOT EXISTS vulcanizers_location_idx ON public.vulcanizers USING GIST (location);

-- Create an RPC function to find nearest vulcanizers
-- This function can be called via the Supabase JS Client:
-- const { data } = await supabase.rpc('find_nearby_vulcanizers', { user_lat: 6.52, user_lng: 3.37, radius_km: 5 })
CREATE OR REPLACE FUNCTION public.find_nearby_vulcanizers(
    user_lat FLOAT,
    user_lng FLOAT,
    radius_km FLOAT
)
RETURNS TABLE (
    id UUID,
    business_name TEXT,
    owner_name TEXT,
    phone TEXT,
    latitude FLOAT,
    longitude FLOAT,
    address TEXT,
    is_open BOOLEAN,
    verified BOOLEAN,
    opening_time TIME,
    closing_time TIME,
    rating FLOAT,
    services TEXT[],
    distance_km FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    user_location GEOGRAPHY(POINT, 4326);
BEGIN
    -- Create geography point for the user's location
    user_location := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;

    RETURN QUERY
    SELECT 
        v.id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.latitude,
        v.longitude,
        v.address,
        v.is_open,
        v.verified,
        v.opening_time,
        v.closing_time,
        v.rating,
        v.services,
        -- Calculate distance in meters, convert to km
        (ST_Distance(v.location, user_location) / 1000.0) AS distance_km
    FROM 
        public.vulcanizers v
    WHERE 
        -- ST_DWithin works with meters for geography type, so multiply radius_km by 1000
        ST_DWithin(v.location, user_location, radius_km * 1000)
    ORDER BY 
        -- Sort by closest first
        distance_km ASC;
END;
$$;

-- Insert some dummy data for testing (e.g. Lagos, Nigeria coordinates)
INSERT INTO public.vulcanizers (business_name, phone, latitude, longitude, address, is_open, rating, services)
VALUES 
('Mike Vulcanizer', '+2348000000001', 6.5244, 3.3792, '12 Broad St, Lagos', true, 4.5, ARRAY['Tire Pump', 'Tire Repair']),
('Goodluck Tyres', '+2348000000002', 6.5250, 3.3750, '45 Marina Rd, Lagos', true, 4.8, ARRAY['Tire Pump', 'Tube Replacement']),
('Kings Vulcanizing', '+2348000000003', 6.5300, 3.3800, '7 Awolowo Rd, Ikoyi', false, 4.2, ARRAY['Tire Repair', 'Wheel Balancing'])
ON CONFLICT DO NOTHING;
