# 🛞 Artisan (Street Artisan & Vulcanizer Finder)

> *"For we are God's handiwork, created in Christ Jesus to do good works, God prepared in advance for us to do." - Ephesians 2:10*

**Artisan** is an open-source, beautifully designed full-stack web application built to help drivers and individuals quickly locate nearby roadside vulcanizers, tailors, cobblers, nail cutters, barbers, and mobile vendors during emergencies. 

It was built to prove a simple point: **Some of the most meaningful software isn't measured by revenue, but by the people it helps.**

For detailed architecture records, audit history, and internal guidelines, see [internal_reference.md](internal_reference.md).

---

## ✨ Features
- **Instant GPS & Location Detection:** One-click location access with smart IP-geolocation fallback.
- **Multi-Category Support:** Locate vulcanizers, tailors, cobblers, nail cutters, barbers, and custom street artisans.
- **Fixed Shops & Mobile Vendors:** Track stationary shops as well as mobile vendors with active scheduled hotspots and auditory cues (*"Listen for iron scissors clicking"*).
- **Night Shift Mode:** Automatic activation and map highlight of night-only service providers during evening and nighttime hours.
- **Interactive Map:** Dark-mode optimized Mapbox GL interface with custom edge zoom sliders.
- **Routing & Directions:** Get exact distance, estimated driving/walking time, and live animated route overlay.
- **One-Tap Contact & Navigation:** Call service providers directly or open direct turn-by-turn routes in Google Maps.
- **Admin Management Dashboard:** Secure `/add` portal for managing artisans, services, mobile hotspots, contributors, and media uploads.
- **Zero Friction:** No sign-up or accounts required for emergency users.

---

## 🛠 Tech Stack

### Frontend (`/frontend`)
- **React 19** & **TypeScript** (Vite v8)
- **Tailwind CSS v4** (Utility styling & animations)
- **Mapbox GL JS** via `react-map-gl` (Interactive geospatial map)
- **Vaul** (Mobile bottom-sheet drawer)
- **Sonner** (Toast notifications)
- **Lucide React** (Modern iconography)
- **Vercel Analytics**

### Backend (`/backend`)
- **Node.js** & **Express** (TypeScript)
- **Supabase** (PostgreSQL + PostGIS extension)
- **PostGIS RPC Functions** (`find_nearby_artisans` for spatial geography radius queries)
- **Security:** Timing-safe PIN authentication (`crypto.timingSafeEqual`) and `express-rate-limit`

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v20+)
- npm (v10+)
- A Supabase project with PostGIS extension enabled
- A Mapbox API Public Access Token

---

### 1. Database Setup (Supabase)
Run the SQL migration scripts located in [`backend/migrations/`](backend/migrations) sequentially in your Supabase SQL Editor:

1. `00_init_legacy.sql`
2. `01_street_artisans.sql`
3. `02_contributors.sql`
4. `03_storage_bucket.sql`
5. `04_artisan_operating_hours.sql`
6. `05_schema_improvements.sql`

---

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Configure your `backend/.env` file:
```env
PORT=3001
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_PIN=1234
FRONTEND_URL=http://localhost:5173
```

Start the backend development server:
```bash
npm run dev
```
The API server will run at `http://localhost:3001`.

---

### 3. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

Create a `frontend/.env.local` file:
```env
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token
VITE_API_URL=http://localhost:3001
```

Start the frontend development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. Access the Admin Dashboard at `http://localhost:5173/add`.

---

## 📖 System Audit & Documentation
For internal design principles, performance guidelines, and audit reports, refer to [internal_reference.md](internal_reference.md).

---

## 📜 License
This project is completely free to use and open-source. For all those who use this solution, for those who will and for those who will not use this project, God bless you still.
