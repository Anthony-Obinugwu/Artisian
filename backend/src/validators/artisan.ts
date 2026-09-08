import { z } from 'zod';

export const artisanCreateSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  latitude: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  longitude: z.union([z.number(), z.string()]).transform((val) => Number(val)),
  address: z.string().optional(),
  category: z.enum(['vulcanizer', 'tailor', 'cobbler', 'nail_cutter', 'barber', 'all']).optional(),
  mobility_type: z.enum(['STATIC', 'MOBILE', 'all']).optional(),
  sound_signal: z.string().nullable().optional(),
  rating: z.union([z.number(), z.string()]).optional(),
  services: z.array(z.string()).optional(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  hotspots: z
    .array(
      z.object({
        location_name: z.string(),
        lat: z.union([z.number(), z.string()]),
        lng: z.union([z.number(), z.string()]),
        start_time: z.string(),
        end_time: z.string(),
        days_active: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

export const artisanUpdateSchema = artisanCreateSchema.partial();
