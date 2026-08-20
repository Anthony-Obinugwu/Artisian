# Vulcanizer Finder (Artisan) - Internal Reference & System Audit

## Overview
This document serves as the master reference guide, architectural record, and system audit for the **Vulcanizer Finder (Artisan)** codebase.

---

## 1. Core Architecture Overview
- **Active Frontend (`/frontend`)**: Built with React 19, TypeScript, Vite, Tailwind CSS v4, Mapbox GL JS (`react-map-gl`), Vaul bottom-sheet drawer, Sonner toast notifications, and Vercel Analytics.
- **Active Backend (`/backend`)**: Built with Node.js, Express, TypeScript, Supabase JS Client (`@supabase/supabase-js`), crypto-based admin authentication, express-rate-limit, and PostGIS RPC integrations.
- **Database Layer (`/backend/migrations`)**: PostgreSQL with PostGIS extension for geography radius queries (`find_nearby_artisans` RPC function).

---

## 2. Audit Findings & Diagnostics

### Category 1: System Redundancies & Duplicate Codebases
1. **Duplicate Frontend Apps (`/web` vs `/frontend`)**:
   - `/web` is an abandoned prototype frontend using Leaflet (`react-leaflet`).
   - `/frontend` is the active production frontend using Mapbox GL.
   - *Impact*: Duplicate dependencies, developer confusion, repository bloat.
2. **Duplicate Backend API Servers (`/api` vs `/backend`)**:
   - `/api/index.js` is a legacy single-file CommonJS Express server using mock data and old routes (`/api/vulcanizers/nearby`).
   - `/backend/src/index.ts` is the current TypeScript Express server handling all production APIs (`/api/artisans/*`).
3. **Root Test Script Redundancies**:
   - Root-level `test.js` and `test_db.js` duplicate test scripts located inside `/backend/`.
4. **Scattered Database Migrations**:
   - `/supabase/migrations/01_init.sql` holds obsolete initial schema (`vulcanizers` table).
   - `/backend/migrations/` (01 to 05) holds the active schema (`artisans`, `artisan_services`, `artisan_hotspots`, `contributors`).
5. **Component Logic Duplication**:
   - Category and mobility filter components are implemented twice with inline UI logic in `App.tsx` (desktop vs mobile bottom drawer).

---

### Category 2: Functional Errors, Security Flaws & Bugs
1. **N+1 Database Queries in Admin Routes**:
   - In `backend/src/index.ts` (lines 160-166 & 227-234), creating/updating artisan services runs a sequential `for` loop with `await` queries per service, causing unnecessary database roundtrips.
2. **Silent Fallback to Low-Privilege API Key**:
   - `backend/src/index.ts` falls back from `SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_ANON_KEY`. If service key is missing, admin database writes fail under RLS.
3. **Rigid CORS Origin Whitelist**:
   - `backend/src/index.ts` hardcodes explicit domain strings. Vercel preview deployment URLs (e.g., `*.vercel.app`) get blocked.
4. **Missing UI Route Entry Point for Admin Dashboard**:
   - No button or link exists in the main app to access `/add` (Admin Dashboard).
5. **Missing Request Payload Validation**:
   - Express backend endpoints accept req.body directly without Zod / schema validation.

---

### Category 3: Performance & Scalability Bottlenecks
1. **45.2 MB Static GIF Asset in Vite Bundle**:
   - `frontend/src/assets/Artisian.gif` is 45.2 MB. Vite bundles this huge file into `dist/assets/`, forcing users to download 45+ MB on loading screen.
2. **DOM-Based Mapbox Marker Rendering Overhead**:
   - `ArtisanMap.tsx` renders individual React DOM `<Marker>` nodes for every artisan and hotspot, which causes frame drops when rendering hundreds of points compared to GeoJSON layers / clustering.
3. **Eager Preloading of Split Chunks**:
   - `App.tsx` triggers dynamic imports of `ArtisanMap` and `ArtisanList` 1000ms after load regardless of user interaction or network speed.

---

## 3. Standard Git Operating Protocol
Per system rules:
- Always reference `internal_reference.md` when planning or implementing changes.
- Branch naming format: `feature/<feature-name>` or `fix/<fix-name>`.
- Always push to remote and open a Pull Request.
