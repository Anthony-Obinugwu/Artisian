import { useMemo, useState, useRef, useEffect } from 'react';
// @ts-ignore
import Map, { Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import { LocateFixed, Info, X } from 'lucide-react';
import { UserPinIcon } from './Icons';
import { CATEGORY_ICONS_LARGE } from './CategoryIcons';
import type { Artisan } from '../App';
import 'mapbox-gl/dist/mapbox-gl.css';

interface ArtisanMapProps {
  userLocation: { lat: number; lng: number };
  artisans: Artisan[];
  activeRoute?: any;
  routingMode?: 'driving' | 'walking';
  routeDetails?: { duration: number; distance: number } | null;
  routeDestination?: Artisan | null;
  isDark?: boolean;
  selectedArtisan?: Artisan | null;
  onPinClick?: (artisan: Artisan) => void;
}



export default function ArtisanMap({ userLocation, artisans, activeRoute, routingMode, routeDetails, routeDestination, isDark, selectedArtisan, onPinClick }: ArtisanMapProps) {
  const [mobileRoute, setMobileRoute] = useState<any>(null);
  const [showLegend, setShowLegend] = useState(false);
  const mapRef = useRef<any>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  // --- Edge Zoom State ---
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [activeZoomSide, setActiveZoomSide] = useState<'left'|'right'|null>(null);
  const initialTouchY = useRef<number | null>(null);
  const initialZoom = useRef<number | null>(null);

  const handleZoomTouchStart = (e: React.TouchEvent, side: 'left'|'right') => {
    e.stopPropagation();
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    initialTouchY.current = e.touches[0].clientY;
    initialZoom.current = map.getZoom();
    setIsZooming(true);
    setActiveZoomSide(side);
    setZoomLevel(initialZoom.current);
  };
  
  const handleZoomTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isZooming || initialTouchY.current === null || initialZoom.current === null || !mapRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - initialTouchY.current;
    
    // Sensitivity: ~40px of sliding equals 1 zoom level
    const zoomDelta = -deltaY / 40; 
    
    // Mapbox standard zoom range is 0 to 22
    const newZoom = Math.max(1, Math.min(22, initialZoom.current + zoomDelta));
    mapRef.current.getMap().setZoom(newZoom);
    setZoomLevel(newZoom);
  };
  
  const handleZoomTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsZooming(false);
    initialTouchY.current = null;
    initialZoom.current = null;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) {
        setShowLegend(false);
      }
    };
    if (showLegend) {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [showLegend]);

  useEffect(() => {
    if (selectedArtisan?.mobility_type === 'MOBILE' && selectedArtisan.hotspots && selectedArtisan.hotspots.length >= 2) {
      const fetchMobileRoute = async () => {
        const coordinates = selectedArtisan.hotspots.map((h: any) => `${h.lng},${h.lat}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            setMobileRoute(data.routes[0].geometry);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchMobileRoute();
    } else {
      setMobileRoute(null);
    }
  }, [selectedArtisan]);

  const pins = useMemo(
    () => {
      const allPins: any[] = [];
      
      artisans.forEach((v) => {
        const isMobile = v.mobility_type === 'MOBILE';
        const icon = CATEGORY_ICONS_LARGE[v.category] || CATEGORY_ICONS_LARGE['all'];
        const isFaded = activeRoute && routeDestination?.id !== v.id;
        
        // Render main pin
        if (v.longitude && v.latitude) {
          allPins.push(
            <Marker
              key={v.id}
              longitude={v.longitude}
              latitude={v.latitude}
              anchor="bottom"
              onClick={(e: any) => {
                e.originalEvent.stopPropagation();
                if (onPinClick) onPinClick(v);
              }}
            >
              <div 
                className={`cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:scale-110 drop-shadow-2xl text-xl bg-slate-900/90 backdrop-blur-md rounded-2xl w-10 h-10 flex items-center justify-center border ${isMobile ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.6)] ring-2 ring-blue-500/30 ring-offset-2 ring-offset-slate-900/50' : 'border-slate-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.4)]'} ${(isFaded && selectedArtisan?.id !== v.id) ? 'opacity-40 grayscale blur-[1px]' : ''} ${selectedArtisan?.id === v.id ? 'ring-2 ring-blue-500/80 scale-110' : ''} relative z-20`}
              >
                {icon}
                {/* Pin pointer tail */}
                <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-r border-b ${isMobile ? 'bg-slate-900/90 border-blue-500/50' : 'bg-slate-900/90 border-slate-700/80'}`} />
              </div>
            </Marker>
          );
        }

        // Hotspots are now rendered via GeoJSON Source/Layer for performance
      });
      return allPins;
    },
    [artisans, activeRoute, routeDestination, selectedArtisan, onPinClick]
  );

  const hotspotsGeoJSON = useMemo(() => {
    const features: any[] = [];
    artisans.forEach((v) => {
      const isMobile = v.mobility_type === 'MOBILE';
      const isFaded = activeRoute && routeDestination?.id !== v.id;
      if (isMobile && v.hotspots && v.hotspots.length > 0) {
        v.hotspots.forEach((h: any) => {
          if (h.lng && h.lat) {
            features.push({
              type: 'Feature',
              properties: {
                id: h.id,
                faded: isFaded
              },
              geometry: {
                type: 'Point',
                coordinates: [h.lng, h.lat]
              }
            });
          }
        });
      }
    });
    return {
      type: 'FeatureCollection',
      features
    };
  }, [artisans, activeRoute, routeDestination]);

  return (
    <div className="relative w-full h-full">
      {routeDetails && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-full shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 z-10 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${routingMode === 'walking' ? 'bg-green-500' : 'bg-blue-600 dark:bg-blue-500'}`} />
            <span className="font-extrabold text-slate-900 dark:text-white">
              {Math.ceil(routeDetails.duration / 60)} min
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-sm font-semibold border-l border-slate-200 dark:border-slate-800 pl-3">
            {(routeDetails.distance / 1000).toFixed(1)} km
          </span>
        </div>
      )}

      <Map
      ref={mapRef}
      initialViewState={{
        longitude: userLocation.lng,
        latitude: userLocation.lat,
        zoom: 13
      }}
      mapStyle={isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12'}
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN || ''}
      style={{ width: '100%', height: '100%' }}
    >
      
      {/* Route Layer */}
      {activeRoute && (
        <Source id="route-source" type="geojson" data={{ type: 'Feature', properties: {}, geometry: activeRoute }}>
          <Layer 
            id="route-layer"
            type="line"
            source="route-source"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': routingMode === 'walking' ? '#22c55e' : '#2563eb',
              'line-width': 6,
              'line-opacity': 0.8,
              'line-dasharray': routingMode === 'walking' ? [2, 2] : [1, 0]
            }}
          />
          <Layer 
            id="route-arrows"
            type="symbol"
            source="route-source"
            layout={{
              'symbol-placement': 'line',
              'text-field': '➤',
              'text-size': 16,
              'symbol-spacing': 100,
              'text-keep-upright': false
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': routingMode === 'walking' ? '#22c55e' : '#2563eb',
              'text-halo-width': 2
            }}
          />
        </Source>
      )}

      {/* Mobile Artisan Route Layer */}
      {mobileRoute && (
        <Source id="mobile-route-source" type="geojson" data={{ type: 'Feature', properties: {}, geometry: mobileRoute }}>
          <Layer 
            id="mobile-route-layer"
            type="line"
            source="mobile-route-source"
            layout={{
              'line-join': 'round',
              'line-cap': 'round'
            }}
            paint={{
              'line-color': '#a855f7',
              'line-width': 4,
              'line-opacity': 0.7,
              'line-dasharray': [2, 2]
            }}
          />
        </Source>
      )}

      {/* Hotspots Layer */}
      <Source id="hotspots-source" type="geojson" data={hotspotsGeoJSON}>
        {/* Outer Glow */}
        <Layer 
          id="hotspots-layer-outer"
          type="circle"
          source="hotspots-source"
          paint={{
            'circle-radius': 8,
            'circle-color': '#3b82f6',
            'circle-opacity': ['case', ['boolean', ['get', 'faded'], false], 0.05, 0.2]
          }}
        />
        {/* Inner Dot */}
        <Layer 
          id="hotspots-layer-inner"
          type="circle"
          source="hotspots-source"
          paint={{
            'circle-radius': 5,
            'circle-color': '#3b82f6',
            'circle-opacity': ['case', ['boolean', ['get', 'faded'], false], 0.3, 1]
          }}
        />
      </Source>

      {/* User Location Marker */}
      <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-12 h-12 bg-blue-500/30 rounded-full animate-ping" />
          <UserPinIcon className="w-8 h-8 animate-pulse drop-shadow-md relative z-10 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 rounded-full" />
        </div>
      </Marker>

      {pins}
    </Map>

    {/* Custom Map Controls (Locate Me) */}
    <div className="absolute right-4 bottom-[25vh] md:bottom-8 z-20 pointer-events-auto">
      <button 
        onClick={() => mapRef.current?.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, duration: 1500 })}
        className="w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700 transition-all hover:scale-105"
        aria-label="Recenter Map"
      >
        <LocateFixed className="w-5 h-5" />
      </button>
    </div>

    {/* Map Legend (Collapsible Info) */}
    <div ref={legendRef} className="absolute left-4 top-4 z-20 flex flex-col items-start gap-2">
      <button 
        onClick={() => setShowLegend(!showLegend)}
        className="w-10 h-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-lg border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors pointer-events-auto"
        aria-label="Toggle Legend"
      >
        {showLegend ? <X className="w-5 h-5" /> : <Info className="w-5 h-5" />}
      </button>

      {showLegend && (
        <div className="flex flex-col gap-3 bg-[#0F172A]/95 backdrop-blur-xl rounded-xl p-4 border border-slate-700/80 shadow-2xl animate-in fade-in slide-in-from-top-2 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border ring-2 ring-blue-500/30 ring-offset-1 ring-offset-slate-900 bg-slate-900 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Mobile Vendor</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 flex items-center justify-center">
               <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,1)] animate-pulse" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Active Hotspot</span>
          </div>
        </div>
      )}
    </div>

    {/* --- Edge Zoom Sliders (Snapchat Style) --- */}
    
    {/* Left Edge Zoom Zone */}
    <div 
      className="absolute left-0 top-0 bottom-0 w-8 z-30 touch-none flex items-center justify-start pl-1 pointer-events-auto"
      onTouchStart={(e) => handleZoomTouchStart(e, 'left')}
      onTouchMove={handleZoomTouchMove}
      onTouchEnd={handleZoomTouchEnd}
      onTouchCancel={handleZoomTouchEnd}
    >
      <div className={`relative w-1.5 h-48 bg-slate-900/40 backdrop-blur-sm rounded-full border border-slate-700/50 transition-opacity duration-300 ${isZooming && activeZoomSide === 'left' ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          className="absolute left-0 right-0 w-1.5 h-8 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-75" 
          style={{ bottom: `${((zoomLevel || 10) / 22) * 100}%`, transform: 'translateY(50%)' }}
        />
      </div>
    </div>

    {/* Right Edge Zoom Zone */}
    <div 
      className="absolute right-0 top-0 bottom-0 w-8 z-30 touch-none flex items-center justify-end pr-1 pointer-events-auto"
      onTouchStart={(e) => handleZoomTouchStart(e, 'right')}
      onTouchMove={handleZoomTouchMove}
      onTouchEnd={handleZoomTouchEnd}
      onTouchCancel={handleZoomTouchEnd}
    >
      <div className={`relative w-1.5 h-48 bg-slate-900/40 backdrop-blur-sm rounded-full border border-slate-700/50 transition-opacity duration-300 ${isZooming && activeZoomSide === 'right' ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          className="absolute left-0 right-0 w-1.5 h-8 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-75" 
          style={{ bottom: `${((zoomLevel || 10) / 22) * 100}%`, transform: 'translateY(50%)' }}
        />
      </div>
    </div>

    </div>
  );
}
