import { useState, useRef, useMemo } from 'react';
// @ts-ignore
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import { MapPin, Trash2, LocateFixed, Clock, Navigation } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface Hotspot {
  location_name: string;
  lat: number | string;
  lng: number | string;
  start_time: string;
  end_time: string;
}

interface AdminMapPickerProps {
  hotspots: Hotspot[];
  onHotspotsChange: (hotspots: Hotspot[]) => void;
  primaryLocation?: { lat: number; lng: number };
}

export default function AdminMapPicker({
  hotspots,
  onHotspotsChange,
  primaryLocation = { lat: 6.5244, lng: 3.3792 },
}: AdminMapPickerProps) {
  const mapRef = useRef<any>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const mapCenter = useMemo(() => {
    if (hotspots.length > 0) {
      const first = hotspots[0];
      return {
        lat: typeof first.lat === 'number' ? first.lat : parseFloat(first.lat as string) || primaryLocation.lat,
        lng: typeof first.lng === 'number' ? first.lng : parseFloat(first.lng as string) || primaryLocation.lng,
      };
    }
    return primaryLocation;
  }, [hotspots, primaryLocation]);

  const reverseGeocode = async (lng: number, lat: number): Promise<string> => {
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) return `Hotspot ${hotspots.length + 1}`;

      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=poi,address,neighborhood,locality&access_token=${token}`
      );
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        return data.features[0].text || data.features[0].place_name.split(',')[0];
      }
      return `Hotspot at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `Hotspot at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  const handleMapClick = async (e: any) => {
    const { lng, lat } = e.lngLat;
    setIsGeocoding(true);

    const locationName = await reverseGeocode(lng, lat);

    const newHotspot: Hotspot = {
      location_name: locationName,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      start_time: '08:00',
      end_time: '18:00',
    };

    onHotspotsChange([...hotspots, newHotspot]);
    setSelectedIndex(hotspots.length);
    setIsGeocoding(false);
  };

  const handleUpdateHotspot = (index: number, field: keyof Hotspot, value: any) => {
    const updated = [...hotspots];
    updated[index] = { ...updated[index], [field]: value };
    onHotspotsChange(updated);
  };

  const handleRemoveHotspot = (index: number) => {
    const updated = hotspots.filter((_, i) => i !== index);
    onHotspotsChange(updated);
    if (selectedIndex === index) setSelectedIndex(null);
  };

  const handleMarkerDragEnd = async (index: number, e: any) => {
    const { lng, lat } = e.lngLat;
    setIsGeocoding(true);
    const locationName = await reverseGeocode(lng, lat);
    const updated = [...hotspots];
    updated[index] = {
      ...updated[index],
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      location_name: locationName,
    };
    onHotspotsChange(updated);
    setIsGeocoding(false);
  };

  const routeGeoJSON = useMemo(() => {
    if (hotspots.length < 2) return null;
    const coordinates = hotspots
      .map((h) => [
        typeof h.lng === 'number' ? h.lng : parseFloat(h.lng as string),
        typeof h.lat === 'number' ? h.lat : parseFloat(h.lat as string),
      ])
      .filter((coord) => !isNaN(coord[0]) && !isNaN(coord[1]));

    if (coordinates.length < 2) return null;

    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates,
      },
    };
  }, [hotspots]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-400" /> Mobile Vendor Operating Route & Hotspots
          </h3>
          <p className="text-xs text-slate-400">
            Click directly on the map to add stop locations along the vendor's route. Drag pins to fine-tune.
          </p>
        </div>
        <div className="text-xs font-medium text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          {hotspots.length} {hotspots.length === 1 ? 'Hotspot' : 'Hotspots'} Added
        </div>
      </div>

      {/* Embedded Map Container */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: mapCenter.lng,
            latitude: mapCenter.lat,
            zoom: 13,
          }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN || ''}
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
          cursor="crosshair"
        >
          {/* Route Connecting Line */}
          {routeGeoJSON && (
            <Source id="admin-route-source" type="geojson" data={routeGeoJSON}>
              <Layer
                id="admin-route-line"
                type="line"
                source="admin-route-source"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{
                  'line-color': '#3b82f6',
                  'line-width': 4,
                  'line-dasharray': [2, 2],
                  'line-opacity': 0.8,
                }}
              />
            </Source>
          )}

          {/* Hotspot Markers */}
          {hotspots.map((h, idx) => {
            const lat = typeof h.lat === 'number' ? h.lat : parseFloat(h.lat as string);
            const lng = typeof h.lng === 'number' ? h.lng : parseFloat(h.lng as string);
            if (isNaN(lat) || isNaN(lng)) return null;

            const isSelected = selectedIndex === idx;

            return (
              <Marker
                key={idx}
                longitude={lng}
                latitude={lat}
                draggable
                onDragEnd={(e) => handleMarkerDragEnd(idx, e)}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedIndex(idx);
                }}
              >
                <div
                  className={`cursor-pointer transition-all flex items-center justify-center rounded-full w-8 h-8 font-extrabold text-xs text-white border shadow-xl ${
                    isSelected
                      ? 'bg-blue-600 border-white ring-4 ring-blue-500/40 scale-110 z-30'
                      : 'bg-slate-900 border-blue-500/60 hover:scale-105 z-20'
                  }`}
                >
                  {idx + 1}
                </div>
              </Marker>
            );
          })}
        </Map>

        {isGeocoding && (
          <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 text-xs text-blue-400 font-medium animate-pulse flex items-center gap-1.5 shadow-lg z-20">
            <MapPin className="w-3.5 h-3.5 animate-bounce" /> Fetching location name...
          </div>
        )}

        <div className="absolute bottom-3 right-3 z-20">
          <button
            type="button"
            onClick={() =>
              mapRef.current?.flyTo({
                center: [primaryLocation.lng, primaryLocation.lat],
                zoom: 14,
              })
            }
            className="w-9 h-9 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            title="Recenter Map"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hotspots Card List */}
      <div className="space-y-3">
        {hotspots.map((hotspot, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedIndex(idx)}
            className={`p-4 rounded-xl border transition-all ${
              selectedIndex === idx
                ? 'bg-slate-900 border-blue-500/60 ring-1 ring-blue-500/30'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  required
                  value={hotspot.location_name}
                  onChange={(e) => handleUpdateHotspot(idx, 'location_name', e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm font-semibold text-white outline-none focus:border-blue-500"
                  placeholder="Street / Landmark Name"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveHotspot(idx)}
                className="text-slate-500 hover:text-red-400 p-1.5 transition-colors rounded-lg hover:bg-slate-800"
                title="Remove Stop"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={hotspot.lat}
                  onChange={(e) => handleUpdateHotspot(idx, 'lat', parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={hotspot.lng}
                  onChange={(e) => handleUpdateHotspot(idx, 'lng', parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Start
                </label>
                <input
                  type="time"
                  value={hotspot.start_time}
                  onChange={(e) => handleUpdateHotspot(idx, 'start_time', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> End
                </label>
                <input
                  type="time"
                  value={hotspot.end_time}
                  onChange={(e) => handleUpdateHotspot(idx, 'end_time', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        ))}

        {hotspots.length === 0 && (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
            <p className="text-xs text-slate-400">
              No hotspots placed yet. Click anywhere on the map above to drop mobile vendor stop locations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
