import { useState, useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { toast } from 'sonner';
import AnimatedBackground from './components/AnimatedBackground';
import { CATEGORY_ICONS } from './components/CategoryIcons';
import BottomSheet from './components/BottomSheet';
import artisianGif from './assets/Artisian.gif';
import artisianPng from './assets/Artisian.png';

// Code-split the heavy map and list components so they don't block the landing page load
const ArtisanMap = lazy(() => import('./components/ArtisanMap'));
const ArtisanList = lazy(() => import('./components/ArtisanList'));

export type Artisan = {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  latitude: number;
  longitude: number;
  address: string;
  is_open: boolean;
  rating: number;
  services: string[];
  distance_km: number;
  category: string;
  mobility_type: string;
  sound_signal: string | null;
  hotspots: any[];
  start_time?: string;
  end_time?: string;
};

function App() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [artisans, setArtisans] = useState<Artisan[] | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [activeRoute, setActiveRoute] = useState<any>(null);
  const [routeDetails, setRouteDetails] = useState<{ duration: number; distance: number } | null>(null);
  const [routingMode, setRoutingMode] = useState<'driving' | 'walking'>('driving');
  const [routeDestination, setRouteDestination] = useState<Artisan | null>(null);
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeMobility, setActiveMobility] = useState<string>('all');
  const [snap, setSnap] = useState<number>(0.2);
  const [isDark, setIsDark] = useState<boolean>(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [contributors, setContributors] = useState<any[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);

  const checkIsNightShift = () => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        hour: 'numeric',
        hour12: false
      });
      const hour = parseInt(formatter.format(new Date()), 10);
      return hour >= 19 || hour < 6;
    } catch (e) {
      // Fallback if timezone not supported
      const hour = new Date().getHours();
      return hour >= 19 || hour < 6;
    }
  };

  const [isNightShift, setIsNightShift] = useState<boolean>(checkIsNightShift());
  const [showNightInfoPopover, setShowNightInfoPopover] = useState<boolean>(false);

  // Preload the heavy map library in the background 1 second after the landing page is interactive
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./components/ArtisanMap');
      import('./components/ArtisanList');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsNightShift(checkIsNightShift());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isNightShift) {
      setIsDark(true);
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [isNightShift]);

  useEffect(() => {
    if (showAbout && contributors.length === 0 && !loadingContributors) {
      setLoadingContributors(true);
      fetch(`${import.meta.env.VITE_API_URL}/api/contributors`)
        .then(res => res.json())
        .then(data => setContributors(data))
        .catch(err => console.error('Failed to fetch contributors:', err))
        .finally(() => setLoadingContributors(false));
    }
  }, [showAbout]);

  // Intentionally blanked out duplicated useEffect

  const fetchRoute = async (dest: Artisan, mode: 'driving' | 'walking') => {
    if (!location) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${mode}/${location.lng},${location.lat};${dest.longitude},${dest.latitude}?geometries=geojson&access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`
      );
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        setActiveRoute(data.routes[0].geometry);
        setRouteDetails({
          duration: data.routes[0].duration,
          distance: data.routes[0].distance
        });
        setRouteDestination(dest);
      }
    } catch (err) {
      console.error('Failed to fetch route:', err);
    }
  };

  const handleCancelRoute = () => {
    setActiveRoute(null);
    setRouteDetails(null);
    setRouteDestination(null);
  };

  const handleRoutingModeChange = (mode: 'driving' | 'walking') => {
    setRoutingMode(mode);
    if (routeDestination) {
      fetchRoute(routeDestination, mode);
    }
  };

  const handlePinClick = (artisan: Artisan) => {
    setSelectedArtisanId(artisan.id);
    setSnap(0.5); // Snap drawer up
  };

  const fetchNearby = async (lat: number, lng: number, category = activeCategory, mobility = activeMobility) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/artisans/nearby?lat=${lat}&lng=${lng}&radius=15&category=${category}&mobility=${mobility}`);
      if (!res.ok) throw new Error('Failed to fetch from backend. Ensure DB migrations are run.');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setArtisans(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (location) {
      fetchNearby(location.lat, location.lng, activeCategory, activeMobility);
    }
  }, [activeCategory, activeMobility]);

  const requestLocation = () => {
    setIsLoading(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported. Using default location.');
      setLocation({ lat: 6.5244, lng: 3.3792 });
      fetchNearby(6.5244, 3.3792);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ lat, lng });
        fetchNearby(lat, lng);
      },
      async (error) => {
        console.warn('Geolocation error:', error);
        try {
          const ipRes = await fetch('https://ipwho.is/');
          const ipData = await ipRes.json();
          if (ipData && ipData.success && ipData.latitude && ipData.longitude) {
            setLocation({ lat: ipData.latitude, lng: ipData.longitude });
            fetchNearby(ipData.latitude, ipData.longitude);
          } else {
            throw new Error('IP Location missing coordinates');
          }
        } catch (ipErr) {
          console.error('IP Fallback error:', ipErr);
          toast.error(`Location access failed completely. Using default location (Lagos) for demo.`);
          setLocation({ lat: 6.5244, lng: 3.3792 });
          fetchNearby(6.5244, 3.3792);
        }
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
    );
  };

  if (isLoading) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#060B18] relative z-0 overflow-hidden">
          {/* Blurred Background GIF */}
          <img
            src={artisianGif}
            alt="Loading background"
            className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm z-0"
          />
          <div className="absolute inset-0 bg-[#060B18]/40 z-0"></div>

          <div className="relative z-10 flex flex-col items-center">
            <p className="text-xl font-bold text-white drop-shadow-md animate-pulse">Chill these npcs are on it...</p>
          </div>
        </div>
        <Analytics />
      </>
    );
  }

  if (location && artisans !== null) {
    return (
      <>
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 md:flex-row overflow-hidden relative">
          <Suspense fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060B18] z-50 overflow-hidden">
              <img
                src={artisianGif}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm z-0"
              />
              <div className="absolute inset-0 bg-[#060B18]/40 z-0"></div>
              <div className="relative z-10 flex flex-col items-center">
                {/* <p className="text-xl font-bold text-white drop-shadow-md animate-pulse">Loading map...</p> */}
              </div>
            </div>
          }>
            {/* Filters Bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4 hidden md:flex flex-col gap-2">
              {isNightShift && (
                <div className="flex justify-center mb-1 relative">
                  <button
                    onClick={() => setShowNightInfoPopover(!showNightInfoPopover)}
                    className="bg-indigo-900/90 text-indigo-200 border border-indigo-500/50 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(99,102,241,0.5)] flex items-center gap-2 hover:bg-indigo-800 transition-colors"
                  >
                    <span className="text-sm">🌙</span> Night Shift Active
                  </button>
                  {showNightInfoPopover && (
                    <div className="absolute top-full mt-2 w-64 bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-700 shadow-2xl text-xs z-50 text-center animate-in fade-in zoom-in duration-200">
                      Night-only artisans are now active on the map. These artisans operate exclusively during nighttime hours.
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 overflow-x-auto no-scrollbar bg-[#0F172A]/80 backdrop-blur-xl p-2.5 rounded-2xl border border-slate-700/50 shadow-2xl">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'vulcanizer', label: 'Vulcanizer' },
                  { id: 'tailor', label: 'Tailor' },
                  { id: 'cobbler', label: 'Cobbler' },
                  { id: 'nail_cutter', label: 'Nails' },
                  { id: 'barber', label: 'Barber' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${activeCategory === cat.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                  >
                    <span>{CATEGORY_ICONS[cat.id]}</span> {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex justify-center gap-2">
                <div className="bg-[#0F172A]/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-700/50 shadow-xl flex">
                  {[
                    { id: 'all', label: 'Any Mobility' },
                    { id: 'STATIC', label: 'Fixed Shops' },
                    { id: 'MOBILE', label: 'Mobile/Walking' }
                  ].map(mob => (
                    <button
                      key={mob.id}
                      onClick={() => setActiveMobility(mob.id)}
                      className={`px-4 py-1 rounded-full text-xs font-medium transition-colors ${activeMobility === mob.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {mob.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Full screen map on mobile, half screen on desktop */}
            <div className="flex-1 relative h-full w-full z-0">
              <ArtisanMap
                userLocation={location}
                artisans={artisans}
                activeRoute={activeRoute}
                routingMode={routingMode}
                routeDetails={routeDetails}
                routeDestination={routeDestination}
                isDark={isDark}
                selectedArtisan={artisans.find(a => a.id === selectedArtisanId) || null}
                onPinClick={handlePinClick}
              />
            </div>

            {/* Desktop List (hidden on mobile) */}
            <div className="hidden md:flex w-[400px] lg:w-[480px] bg-[#060B18] border-l border-slate-800/80 h-full overflow-y-auto shadow-2xl z-10 flex-col">
              <ArtisanList
                artisans={artisans}
                onShowRoute={(dest) => fetchRoute(dest, routingMode)}
                onCancelRoute={handleCancelRoute}
                routingMode={routingMode}
                onRoutingModeChange={handleRoutingModeChange}
                routeDestination={routeDestination}
                selectedArtisanId={selectedArtisanId}
              />
            </div>

            {/* Mobile Bottom Sheet Drawer */}
            <div className="md:hidden">
              <BottomSheet
                isOpen={true}
                snapPoints={[0.2, 0.5, 0.9]}
                currentSnap={snap}
                onSnapChange={setSnap}
                hideBackdrop={true}
              >
                <div className="px-4 pb-2 border-b border-slate-800 flex flex-col gap-2">
                  {isNightShift && (
                    <div className="flex justify-center mt-2 relative">
                      <button
                        onClick={() => setShowNightInfoPopover(!showNightInfoPopover)}
                        className="bg-indigo-900/90 text-indigo-200 border border-indigo-500/50 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(99,102,241,0.5)] flex items-center gap-2"
                      >
                        <span className="text-sm">🌙</span> Night Shift
                      </button>
                      {showNightInfoPopover && (
                        <div className="absolute bottom-full mb-2 w-64 bg-slate-900 text-slate-200 p-3 rounded-xl border border-slate-700 shadow-2xl text-xs z-50 text-center animate-in fade-in slide-in-from-bottom-2 duration-200">
                          Night-only artisans are now active on the map. They operate exclusively during nighttime hours.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-2">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'vulcanizer', label: 'Vulcanizer' },
                      { id: 'tailor', label: 'Tailor' },
                      { id: 'cobbler', label: 'Cobbler' },
                      { id: 'nail_cutter', label: 'Nails' },
                      { id: 'barber', label: 'Barber' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${activeCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                      >
                        <span>{CATEGORY_ICONS[cat.id]}</span> {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center gap-2 mb-2">
                    <div className="bg-slate-800 p-1 rounded-full flex w-full">
                      {[
                        { id: 'all', label: 'Any' },
                        { id: 'STATIC', label: 'Shops' },
                        { id: 'MOBILE', label: 'Mobile' }
                      ].map(mob => (
                        <button
                          key={mob.id}
                          onClick={() => setActiveMobility(mob.id)}
                          className={`flex-1 py-1 rounded-full text-xs font-medium transition-colors ${activeMobility === mob.id ? 'bg-slate-600 text-white' : 'text-slate-400'}`}
                        >
                          {mob.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <ArtisanList
                  artisans={artisans}
                  onShowRoute={(dest) => {
                    fetchRoute(dest, routingMode);
                    setSnap(0.2); // Snap down when they click to see the route on map
                  }}
                  onCancelRoute={handleCancelRoute}
                  routingMode={routingMode}
                  onRoutingModeChange={handleRoutingModeChange}
                  routeDestination={routeDestination}
                  selectedArtisanId={selectedArtisanId}
                />
              </BottomSheet>
            </div>
          </Suspense>
        </div>
        <Analytics />
      </>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#060B18] p-6 relative z-0 overflow-hidden">
      <AnimatedBackground />

      <div className="max-w-[420px] w-full bg-[#0F172A]/90 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-800/80 relative z-10">
        <div className="p-10 text-center flex flex-col items-center">
          <div className="pointer-events-none hover:scale-110 transition-transform duration-700 ease-out mx-auto mb-6 relative">
            <img src={artisianPng} alt="Artisan Logo" className="w-24 h-24 sm:w-32 sm:h-32 opacity-80 relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:drop-shadow-[0_0_25px_rgba(59,130,246,0.8)] transition-all duration-500" />
          </div>

          <div className="flex items-center justify-center text-3xl font-bold tracking-tight mb-8">
            {/* <span className="text-white">pump&nbsp;</span> */}
            <span className="text-[#3b82f6]">Artisan</span>
          </div>

          <h1 className="text-[2.25rem] font-extrabold text-white mb-4 tracking-tight leading-tight">
            A map of service providers
          </h1>

          <p className="text-slate-400 mb-8 text-lg leading-relaxed">
            Flat tire? Torn shirt? Bad shoe?, We'll instantly locate the closest vulcanizers, tailors, and cobblers using your current location.
          </p>

          <button
            onClick={requestLocation}
            className="w-full bg-[#2563EB] hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-3 text-lg"
          >
            Allow Location Access
          </button>

          <div className="w-full mt-6">
            <p className="text-slate-500 text-xs italic">
              We only use your location to find artisans near you. It's not stored, so relax.
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-slate-500 text-xs">
          © 2026{' '}
          <button
            onClick={() => setShowAbout(true)}
            className="text-slate-400 hover:text-white transition-colors underline underline-offset-4"
          >
            TheseNPCs
          </button>
        </p>
      </div>

      <BottomSheet isOpen={showAbout} onClose={() => setShowAbout(false)}>
        <div className="max-w-md mx-auto px-4 pb-8 text-slate-300 pt-4">
          <p className="text-xs text-slate-400 italic mb-8 leading-relaxed border-l-2 border-blue-900/50 pl-3">
            "For we are God's handiwork, created in Christ Jesus to do good works, God prepared in advance for us to do." - Ephesians 2:10.
          </p>
          <h2 className="text-2xl font-bold text-white mb-4">About the Project</h2>
          <p className="mb-8 leading-relaxed">
            Artisan is an open-source project that helps people quickly locate nearby vulcanizers, tailors, and cobblers during emergencies. It was built to prove that some of the most meaningful software isn't measured by revenue, but by the people it helps.
          </p>
          <h3 className="text-lg font-semibold text-white mb-4">Contributors</h3>

          {loadingContributors ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <ul className="space-y-6">
              {contributors.length === 0 ? (
                <li className="text-slate-500 italic text-sm">No contributors listed yet.</li>
              ) : (
                contributors.map(c => (
                  <li key={c.id} className="flex items-center gap-4">
                    <img src={c.image_url} alt={c.name} className="w-12 h-12 rounded-full object-cover bg-slate-800 border border-slate-700" />
                    <div>
                      <p className="text-white font-medium">{c.name}</p>
                      <p className="text-sm text-slate-500">{c.role}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </BottomSheet>
      <Analytics />
    </div>
  );
}

export default App;
