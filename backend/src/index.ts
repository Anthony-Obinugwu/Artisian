import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Restrict CORS to specific frontend domain in production
// We remove any trailing slashes just in case it was accidentally included in the dashboard
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const frontendUrl = rawFrontendUrl.replace(/\/$/, '');
const allowedOrigins = [
  frontendUrl,
  'https://www.thesenpcs.com',
  'https://www.thesenpcs.ng',
  'https://thesenpcs.ng',
  'https://thesenpcs.com',
  'https://vulcanizer-finder.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

  if (allowedOrigins.indexOf(origin) !== -1 || /^https:\/\/.*\.vercel\.app$/.test(origin)) {
    return callback(null, true);
  }

  console.error(`[CORS BLOCK] Origin '${origin}' is not allowed. Expected: '${frontendUrl}'`);
  var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
  return callback(new Error(msg), false);
}
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiter for the Admin creation route (max 5 requests per 15 minutes)
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Increased for dashboard usage
  message: { error: 'Too many admin requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authenticateAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminPin = req.headers['x-admin-pin'] as string | undefined;

  if (!process.env.ADMIN_PIN) {
    return res.status(500).json({ error: 'Server misconfiguration: ADMIN_PIN not set.' });
  }

  if (!adminPin || adminPin.length !== process.env.ADMIN_PIN.length) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Admin PIN' });
  }

  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(adminPin),
      Buffer.from(process.env.ADMIN_PIN)
    );

    if (!isMatch) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Admin PIN' });
    }

    next();
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(500).json({ error: 'Auth Internal error.', details: error });
  }
};

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
  console.warn('[SECURITY WARNING] SUPABASE_SERVICE_ROLE_KEY is missing! Using ANON_KEY fallback which may fail RLS policies.');
}

const supabaseKey = supabaseServiceKey || supabaseAnonKey || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: WebSocket as any }
});

app.get('/api/artisans/nearby', async (req, res) => {
  try {
    const { lat, lng, radius, category, mobility } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng query parameters.' });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid lat or lng. Must be numbers.' });
    }

    // Default radius is 5km if not provided
    const radius_km = radius ? parseFloat(radius as string) : 5;

    // Call the PostGIS RPC function created in Supabase
    const { data, error } = await supabase.rpc('find_nearby_artisans', {
      user_lat: latitude,
      user_lng: longitude,
      radius_km: radius_km,
      filter_category: category || 'all',
      filter_mobility: mobility || 'all'
    });

    if (error) {
      console.error('Supabase RPC Error:', error);
      return res.status(500).json({ error: 'Database query failed.', details: error });
    }

    res.json(data);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/artisans', adminRateLimiter, authenticateAdmin, async (req, res) => {
  try {
    const { business_name, owner_name, phone, latitude, longitude, address, services, category, mobility_type, sound_signal, hotspots, rating, start_time, end_time } = req.body;

    const parsedLat = parseFloat(latitude);
    const parsedLng = parseFloat(longitude);

    if (!business_name || isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'Missing or invalid required fields: business_name, latitude, or longitude.' });
    }

    const { data: artisanData, error: artisanError } = await supabase.from('artisans').insert([{
      business_name,
      owner_name,
      phone,
      location: `POINT(${parsedLng} ${parsedLat})`,
      address,
      category: category || 'vulcanizer',
      mobility_type: mobility_type || 'STATIC',
      sound_signal: sound_signal || null,
      is_open: true,
      verified: false,
      rating: rating !== undefined ? parseFloat(rating) : 0.0,
      start_time: start_time || null,
      end_time: end_time || null
    }]).select().single();

    if (artisanError) {
      console.error('Supabase Insert Error:', artisanError);
      return res.status(500).json({ error: 'Failed to insert into database.', details: artisanError });
    }

    // Batch upsert services and batch insert artisan_services (avoids N+1 query overhead)
    if (services && Array.isArray(services) && services.length > 0) {
      const servicesToUpsert = services.map((s: string) => ({ name: s }));
      const { data: srvDataList } = await supabase
        .from('services')
        .upsert(servicesToUpsert, { onConflict: 'name' })
        .select();

      if (srvDataList && srvDataList.length > 0) {
        const artisanServicesToInsert = srvDataList.map((srv) => ({
          artisan_id: artisanData.id,
          service_id: srv.id
        }));
        await supabase.from('artisan_services').insert(artisanServicesToInsert);
      }
    }

    if (mobility_type === 'MOBILE' && hotspots && Array.isArray(hotspots) && hotspots.length > 0) {
      const hotspotsToInsert = [];

      for (const h of hotspots) {
        const hLat = parseFloat(h.lat);
        const hLng = parseFloat(h.lng);

        if (!isNaN(hLat) && !isNaN(hLng) && h.location_name && h.start_time && h.end_time) {
          hotspotsToInsert.push({
            artisan_id: artisanData.id,
            location_name: h.location_name,
            location: `POINT(${hLng} ${hLat})`,
            start_time: h.start_time,
            end_time: h.end_time,
            days_active: h.days_active || []
          });
        }
      }

      if (hotspotsToInsert.length > 0) {
        const { error: hotspotError } = await supabase.from('artisan_hotspots').insert(hotspotsToInsert);

        if (hotspotError) {
          console.error('Supabase Hotspot Insert Error:', hotspotError);
        }
      }
    }

    res.status(201).json({ success: true, data: artisanData });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Admin Dashboard Routes
app.get('/api/artisans/all', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_all_artisans_admin');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('All Artisans Error:', error);
    res.status(500).json({ error: 'Internal server error.', details: error });
  }
});

app.put('/api/artisans/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { business_name, owner_name, phone, address, services, category, mobility_type, sound_signal, rating, is_open, start_time, end_time } = req.body;
    
    const { data, error } = await supabase.from('artisans')
      .update({ business_name, owner_name, phone, address, category, mobility_type, sound_signal, rating: rating !== undefined ? parseFloat(rating) : undefined, is_open, start_time: start_time || null, end_time: end_time || null })
      .eq('id', id)
      .select().single();
      
    if (error) throw error;

    // Batch update artisan services (avoids N+1 query overhead)
    if (services && Array.isArray(services)) {
      await supabase.from('artisan_services').delete().eq('artisan_id', id);
      if (services.length > 0) {
        const servicesToUpsert = services.map((s: string) => ({ name: s }));
        const { data: srvDataList } = await supabase
          .from('services')
          .upsert(servicesToUpsert, { onConflict: 'name' })
          .select();

        if (srvDataList && srvDataList.length > 0) {
          const artisanServicesToInsert = srvDataList.map((srv) => ({
            artisan_id: id,
            service_id: srv.id
          }));
          await supabase.from('artisan_services').insert(artisanServicesToInsert);
        }
      }
    }
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update artisan.' });
  }
});

app.delete('/api/artisans/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('artisans').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete artisan.' });
  }
});

// Storage Route
app.post('/api/upload', authenticateAdmin, async (req, res) => {
  try {
    const { base64Data, fileName, contentType } = req.body;
    if (!base64Data || !fileName || !contentType) {
      return res.status(400).json({ error: 'Missing required fields: base64Data, fileName, contentType' });
    }

    // Remove the data:image/...;base64, prefix if it exists
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '').replace(/^data:image\/svg\+xml;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    // Create a unique filename
    const uniqueFileName = `${Date.now()}-${fileName}`;

    const { data, error } = await supabase.storage
      .from('contributors')
      .upload(uniqueFileName, buffer, {
        contentType,
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('contributors')
      .getPublicUrl(uniqueFileName);

    res.json({ success: true, url: publicUrlData.publicUrl });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

// Contributors Routes
app.get('/api/contributors', async (req, res) => {
  try {
    const { data, error } = await supabase.from('contributors').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/contributors', authenticateAdmin, async (req, res) => {
  try {
    const { name, role, image_url } = req.body;
    if (!name || !role || !image_url) {
      return res.status(400).json({ error: 'Missing required fields: name, role, image_url' });
    }
    const { data, error } = await supabase.from('contributors').insert([{ name, role, image_url }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add contributor.' });
  }
});

app.delete('/api/contributors/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('contributors').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete contributor.' });
  }
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});
