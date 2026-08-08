-- 1. Convert 'location' from a GENERATED column to a standard geography column
ALTER TABLE artisans ADD COLUMN new_location GEOGRAPHY(POINT, 4326);
UPDATE artisans SET new_location = location;
DROP INDEX IF EXISTS vulcanizers_location_idx;
DROP INDEX IF EXISTS idx_artisans_location;
ALTER TABLE artisans DROP COLUMN location;
ALTER TABLE artisans RENAME COLUMN new_location TO location;
CREATE INDEX IF NOT EXISTS idx_artisans_location ON public.artisans USING GIST (location);

-- 2. Drop redundant time and coordinate columns
ALTER TABLE artisans
DROP COLUMN IF EXISTS opening_time,
DROP COLUMN IF EXISTS closing_time,
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude;

-- 3. Add audit timestamps to artisans
ALTER TABLE artisans
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a trigger to update 'updated_at' automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_artisans_updated_at ON artisans;
CREATE TRIGGER update_artisans_updated_at
BEFORE UPDATE ON artisans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Fix foreign keys in child tables
-- Drop existing constraints
ALTER TABLE artisan_hotspots DROP CONSTRAINT IF EXISTS artisan_hotspots_artisan_id_fkey;
ALTER TABLE artisan_routes DROP CONSTRAINT IF EXISTS artisan_routes_artisan_id_fkey;

-- Add new cascading constraints and set NOT NULL
ALTER TABLE artisan_hotspots 
  ALTER COLUMN artisan_id SET NOT NULL,
  ADD CONSTRAINT artisan_hotspots_artisan_id_fkey 
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE;

ALTER TABLE artisan_routes 
  ALTER COLUMN artisan_id SET NOT NULL,
  ADD CONSTRAINT artisan_routes_artisan_id_fkey 
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE;

-- 5. Services Normalization
-- Ensure the services table exists and has a unique constraint on name
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- Ensure UNIQUE constraint if table already existed but without it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_name_key'
  ) THEN
    ALTER TABLE services ADD CONSTRAINT services_name_key UNIQUE (name);
  END IF;
END $$;

-- Create the junction table
CREATE TABLE IF NOT EXISTS artisan_services (
  artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (artisan_id, service_id)
);

-- Migrate existing services from the text array in artisans
DO $$
DECLARE
  rec RECORD;
  service_name TEXT;
  s_id UUID;
BEGIN
  FOR rec IN SELECT id, services FROM artisans WHERE services IS NOT NULL LOOP
    IF rec.services IS NOT NULL THEN
      -- Assuming services is a text array or jsonb array of strings. 
      -- In the previous schema it was `_text` (text[]) but could be parsed differently.
      -- Let's handle it as a jsonb array since the RPC casted it to jsonb.
      -- If it's a text array, jsonb_array_elements_text(to_jsonb(rec.services)) works.
      FOR service_name IN SELECT jsonb_array_elements_text(to_jsonb(rec.services)) LOOP
        -- Insert into services if not exists
        INSERT INTO services (name) VALUES (service_name)
        ON CONFLICT (name) DO NOTHING;
        
        -- Get the service id
        SELECT id INTO s_id FROM services WHERE name = service_name;
        
        -- Link it
        INSERT INTO artisan_services (artisan_id, service_id) VALUES (rec.id, s_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Drop the services array column from artisans
ALTER TABLE artisans DROP COLUMN IF EXISTS services;

-- 6. Update find_nearby_artisans RPC
DROP FUNCTION IF EXISTS find_nearby_artisans(float, float, float, text, text);

CREATE OR REPLACE FUNCTION find_nearby_artisans(
  user_lat float, 
  user_lng float, 
  radius_km float,
  filter_category text DEFAULT NULL,
  filter_mobility text DEFAULT NULL
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
  rating FLOAT,
  services JSONB,
  category TEXT,
  mobility_type TEXT,
  sound_signal TEXT,
  distance_km FLOAT,
  hotspots JSONB,
  start_time TIME,
  end_time TIME
) AS $$
DECLARE
  user_point geography := st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography;
  radius_m float := radius_km * 1000;
  current_wat_time time := CURRENT_TIME AT TIME ZONE 'Africa/Lagos';
BEGIN
  RETURN QUERY
  WITH nearby_static AS (
    SELECT 
      a.id,
      st_distance(a.location, user_point) / 1000 AS dist
    FROM artisans a
    WHERE a.mobility_type = 'STATIC'
      AND a.location IS NOT NULL
      AND st_dwithin(a.location, user_point, radius_m)
  ),
  nearby_mobile_hotspots AS (
    SELECT 
      ah.artisan_id AS id,
      st_distance(ah.location, user_point) / 1000 AS dist,
      jsonb_agg(
        jsonb_build_object(
          'id', ah.id,
          'location_name', ah.location_name,
          'start_time', ah.start_time,
          'end_time', ah.end_time,
          'lat', st_y(ah.location::geometry),
          'lng', st_x(ah.location::geometry)
        )
      ) AS active_hotspots
    FROM artisan_hotspots ah
    WHERE st_dwithin(ah.location, user_point, radius_m)
    GROUP BY ah.artisan_id, ah.location
  ),
  nearby_mobile_ping AS (
    SELECT 
      a.id,
      st_distance(a.last_ping_location, user_point) / 1000 AS dist
    FROM artisans a
    WHERE a.mobility_type = 'MOBILE'
      AND a.last_ping_location IS NOT NULL
      AND st_dwithin(a.last_ping_location, user_point, radius_m)
  ),
  combined_ids AS (
    SELECT ns.id, ns.dist, '[]'::jsonb AS hotspots FROM nearby_static ns
    UNION ALL
    SELECT nmh.id, nmh.dist, nmh.active_hotspots FROM nearby_mobile_hotspots nmh
    UNION ALL
    SELECT nmp.id, nmp.dist, '[]'::jsonb AS hotspots FROM nearby_mobile_ping nmp
  ),
  unique_nearby AS (
    SELECT 
      c.id, 
      MIN(c.dist) AS min_dist,
      jsonb_agg(elements) FILTER (WHERE elements IS NOT NULL) AS all_hotspots
    FROM combined_ids c
    LEFT JOIN LATERAL jsonb_array_elements(c.hotspots) AS elements ON true
    GROUP BY c.id
  ),
  artisan_service_names AS (
    SELECT 
      arts.artisan_id,
      jsonb_agg(s.name) AS service_list
    FROM artisan_services arts
    JOIN services s ON s.id = arts.service_id
    GROUP BY arts.artisan_id
  )
  SELECT 
    a.id,
    a.business_name,
    a.owner_name,
    a.phone,
    st_y(a.location::geometry) AS latitude,
    st_x(a.location::geometry) AS longitude,
    a.address,
    a.is_open,
    a.rating,
    COALESCE(asn.service_list, '[]'::jsonb) AS services,
    a.category,
    a.mobility_type,
    a.sound_signal,
    u.min_dist AS distance_km,
    COALESCE(u.all_hotspots, '[]'::jsonb) AS hotspots,
    a.start_time,
    a.end_time
  FROM unique_nearby u
  JOIN artisans a ON a.id = u.id
  LEFT JOIN artisan_service_names asn ON asn.artisan_id = a.id
  WHERE (filter_category IS NULL OR filter_category = 'all' OR a.category = filter_category)
    AND (filter_mobility IS NULL OR filter_mobility = 'all' OR a.mobility_type = filter_mobility)
    AND (
      a.start_time IS NULL OR a.end_time IS NULL OR
      (
        (a.start_time < a.end_time AND current_wat_time >= a.start_time AND current_wat_time <= a.end_time)
        OR
        (a.start_time > a.end_time AND (current_wat_time >= a.start_time OR current_wat_time <= a.end_time))
        OR
        (a.start_time = a.end_time)
      )
    )
  ORDER BY u.min_dist ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. Create get_all_artisans_admin RPC
CREATE OR REPLACE FUNCTION get_all_artisans_admin()
RETURNS TABLE (
  id UUID,
  business_name TEXT,
  owner_name TEXT,
  phone TEXT,
  latitude FLOAT,
  longitude FLOAT,
  address TEXT,
  is_open BOOLEAN,
  rating FLOAT,
  services JSONB,
  category TEXT,
  mobility_type TEXT,
  sound_signal TEXT,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH artisan_service_names AS (
    SELECT 
      arts.artisan_id,
      jsonb_agg(s.name) AS service_list
    FROM artisan_services arts
    JOIN services s ON s.id = arts.service_id
    GROUP BY arts.artisan_id
  )
  SELECT 
    a.id,
    a.business_name,
    a.owner_name,
    a.phone,
    st_y(a.location::geometry) AS latitude,
    st_x(a.location::geometry) AS longitude,
    a.address,
    a.is_open,
    a.rating,
    COALESCE(asn.service_list, '[]'::jsonb) AS services,
    a.category,
    a.mobility_type,
    a.sound_signal,
    a.start_time,
    a.end_time,
    a.created_at,
    a.updated_at
  FROM artisans a
  LEFT JOIN artisan_service_names asn ON asn.artisan_id = a.id
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql;
