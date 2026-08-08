import { useState, useEffect } from 'react';
import { Loader2, MapPin, Plus, Trash2, X, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import Alert from '../Alert';
import CustomSelect from '../CustomSelect';
import { CATEGORY_ICONS } from '../CategoryIcons';

const DEFAULT_SERVICES: Record<string, string[]> = {
  vulcanizer: ['Tire Pump', 'Tire Patching', 'Wheel Balancing', 'Tube Replacement', 'Tire Sales'],
  tailor: ['Hemming', 'Patching/Mending', 'Zipper Replacement', 'Ironing', 'Resizing'],
  cobbler: ['Shoe Polishing', 'Sole Replacement', 'Heel Repair', 'Stitching', 'Bag Repair'],
  nail_cutter: ['Fingernail Clipping', 'Toenail Clipping', 'Callus Removal'],
  barber: ['Haircut', 'Beard Trim', 'Dyeing', 'Shaving'],
  other: []
};

export default function AddArtisanTab({ adminPin }: { adminPin: string }) {
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    latitude: '',
    longitude: '',
    address: '',
    category: 'vulcanizer',
    mobility_type: 'STATIC',
    sound_signal: '',
    rating: '5.0',
    start_time: '',
    end_time: ''
  });

  const [hotspots, setHotspots] = useState<any[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  
  const [availableServices, setAvailableServices] = useState<string[]>(DEFAULT_SERVICES['vulcanizer']);
  
  const [services, setServices] = useState<Record<string, boolean>>({
    'Tire Pump': true,
    'Tire Patching': false,
    'Wheel Balancing': false,
    'Tube Replacement': false,
    'Tire Sales': false
  });
  
  const [customServiceInput, setCustomServiceInput] = useState('');

  useEffect(() => {
    if (formData.category === 'other') {
      setAvailableServices([]);
      setServices({});
      return;
    }
    
    const defaults = DEFAULT_SERVICES[formData.category] || [];
    setAvailableServices(defaults);
    
    const newServices: Record<string, boolean> = {};
    defaults.forEach((s, idx) => {
      newServices[s] = idx === 0;
    });
    setServices(newServices);
  }, [formData.category]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleServiceChange = (service: string) => {
    setServices((prev) => ({ ...prev, [service]: !prev[service] }));
  };

  const handleAddCustomService = () => {
    const trimmed = customServiceInput.trim();
    if (!trimmed) return;
    
    if (!availableServices.includes(trimmed)) {
      setAvailableServices(prev => [...prev, trimmed]);
    }
    setServices(prev => ({ ...prev, [trimmed]: true }));
    setCustomServiceInput('');
  };

  const removeService = (service: string) => {
    setAvailableServices(prev => prev.filter(s => s !== service));
    const newServices = { ...services };
    delete newServices[service];
    setServices(newServices);
  };

  const addHotspot = () => {
    setHotspots([...hotspots, { location_name: '', lat: '', lng: '', start_time: '08:00', end_time: '18:00' }]);
  };

  const updateHotspot = (index: number, field: string, value: string) => {
    const newHotspots = [...hotspots];
    newHotspots[index][field] = value;
    setHotspots(newHotspots);
  };

  const removeHotspot = (index: number) => {
    setHotspots(hotspots.filter((_, i) => i !== index));
  };

  const getLocation = () => {
    setIsLocating(true);
    setStatus({ type: null, message: '' });

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        setIsLocating(false);
      },
      (error) => {
        toast.error(`Location error: ${error.message}`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedLat = parseFloat(formData.latitude);
    const parsedLng = parseFloat(formData.longitude);
    
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      toast.error('Invalid coordinates. Latitude and Longitude must be numbers.');
      return;
    }

    if (formData.mobility_type === 'MOBILE') {
      for (const h of hotspots) {
        if (!h.location_name || !h.start_time || !h.end_time) {
          toast.error('All hotspots must have a location name, start time, and end time.');
          return;
        }
        if (isNaN(parseFloat(h.lat)) || isNaN(parseFloat(h.lng))) {
          toast.error('Hotspot coordinates must be valid numbers. Please locate each hotspot on the map or enter manually.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    const selectedServices = Object.entries(services)
      .filter(([_, isSelected]) => isSelected)
      .map(([serviceName]) => serviceName);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/artisans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        },
        body: JSON.stringify({
          business_name: formData.business_name,
          owner_name: formData.owner_name,
          phone: formData.phone,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          address: formData.address,
          services: selectedServices,
          category: formData.category === 'other' ? customCategory : formData.category,
          mobility_type: formData.mobility_type,
          sound_signal: formData.sound_signal,
          start_time: formData.start_time,
          end_time: formData.end_time,
          hotspots: hotspots.map(h => ({
            ...h,
            lat: parseFloat(h.lat),
            lng: parseFloat(h.lng)
          })),
          rating: formData.rating
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit data');
      }

      toast.success('Artisan added successfully!');
      
      setFormData((prev) => ({
        ...prev,
        business_name: '',
        latitude: '',
        longitude: '',
        address: '',
        sound_signal: '',
        rating: '5.0',
        start_time: '',
        end_time: ''
      }));
      setHotspots([]);
      setCustomCategory('');
      setCustomServiceInput('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Add Artisan</h1>
        <p className="text-slate-400">Register a new service provider</p>
      </header>

      {status.type && (
        <Alert variant={status.type} message={status.message} className="mb-6" />
      )}

      <form onSubmit={handleSubmit} className="bg-[#0F172A]/90 backdrop-blur-xl p-6 rounded-3xl border border-slate-800/80 shadow-2xl space-y-6">
        <div className="space-y-4 border-b border-slate-800 pb-6">
          <h2 className="text-xl font-semibold text-white">Artisan Type</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category <span className="text-red-400">*</span></label>
              <CustomSelect
                value={formData.category}
                onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                options={[
                  { value: 'vulcanizer', label: 'Vulcanizer', icon: CATEGORY_ICONS['vulcanizer'] },
                  { value: 'tailor', label: 'Tailor', icon: CATEGORY_ICONS['tailor'] },
                  { value: 'cobbler', label: 'Cobbler', icon: CATEGORY_ICONS['cobbler'] },
                  { value: 'nail_cutter', label: 'Nail Cutter', icon: CATEGORY_ICONS['nail_cutter'] },
                  { value: 'barber', label: 'Barber', icon: CATEGORY_ICONS['barber'] },
                  { value: 'other', label: 'Other / Custom', icon: <MoreHorizontal className="w-4 h-4 text-slate-400" /> }
                ]}
              />
              
              {formData.category === 'other' && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full bg-[#060B18]/50 border border-blue-500/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none shadow-inner transition-all"
                    placeholder="Enter custom category (e.g. Mechanic)"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Mobility Type <span className="text-red-400">*</span></label>
              <CustomSelect
                value={formData.mobility_type}
                onChange={(val) => setFormData(prev => ({ ...prev, mobility_type: val }))}
                options={[
                  { value: 'STATIC', label: 'Fixed Shop (Static)' },
                  { value: 'MOBILE', label: 'Mobile Vendor' }
                ]}
              />
            </div>
          </div>
          
          {formData.mobility_type === 'MOBILE' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Sound Signal / Cue</label>
                <input
                  type="text"
                  name="sound_signal"
                  value={formData.sound_signal}
                  onChange={handleInputChange}
                  className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                  placeholder="e.g. Iron scissors clicking"
                />
            </div>
          )}
        </div>

        <div className="space-y-4 border-b border-slate-800 pb-6">
          <h2 className="text-xl font-semibold text-white">Primary Location</h2>
          
          <button
            type="button"
            onClick={getLocation}
            disabled={isLocating}
            className="w-full bg-[#060B18]/40 hover:bg-[#060B18]/60 text-blue-400 border border-slate-700/50 rounded-xl px-4 py-4 flex items-center justify-center gap-2 transition-all font-medium"
          >
            {isLocating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Locating GPS...</>
            ) : (
              <><MapPin className="w-5 h-5" /> Get Current Location</>
            )}
          </button>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Latitude <span className="text-red-400">*</span></label>
              <input
                type="number"
                step="any"
                name="latitude"
                required
                value={formData.latitude}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                placeholder="e.g. 6.5244"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Longitude <span className="text-red-400">*</span></label>
              <input
                type="number"
                step="any"
                name="longitude"
                required
                value={formData.longitude}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                placeholder="e.g. 3.3792"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Street Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
              placeholder="Nearest landmark or street"
            />
          </div>
        </div>

        {formData.mobility_type === 'MOBILE' && (
          <div className="space-y-4 border-b border-slate-800 pb-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Mobile Hotspots</h2>
              <button
                type="button"
                onClick={addHotspot}
                className="text-sm bg-blue-900/50 hover:bg-blue-800 text-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Hotspot
              </button>
            </div>
            
            {hotspots.map((hotspot, idx) => (
              <div key={idx} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeHotspot(idx)}
                  className="absolute top-3 right-3 text-red-400 hover:text-red-300 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Location Name</label>
                  <input
                    type="text"
                    required
                    value={hotspot.location_name}
                    onChange={(e) => updateHotspot(idx, 'location_name', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none"
                    placeholder="e.g. Estate Gate 1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={hotspot.lat}
                      onChange={(e) => updateHotspot(idx, 'lat', e.target.value)}
                      className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
                      placeholder="e.g. 6.52"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={hotspot.lng}
                      onChange={(e) => updateHotspot(idx, 'lng', e.target.value)}
                      className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
                      placeholder="e.g. 3.37"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={hotspot.start_time}
                      onChange={(e) => updateHotspot(idx, 'start_time', e.target.value)}
                      className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={hotspot.end_time}
                      onChange={(e) => updateHotspot(idx, 'end_time', e.target.value)}
                      className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {hotspots.length === 0 && (
              <p className="text-sm text-slate-500 italic text-center py-2">No hotspots added. Artisan will be searchable by their primary location.</p>
            )}
          </div>
        )}

        <div className="space-y-4 border-b border-slate-800 pb-6">
          <h2 className="text-xl font-semibold text-white">Business Details</h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Business Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              name="business_name"
              required
              value={formData.business_name}
              onChange={handleInputChange}
              className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
              placeholder="e.g. Iya Basira Tyres"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Owner Name</label>
              <input
                type="text"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                placeholder="080..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Initial Rating</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                name="rating"
                value={formData.rating}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                placeholder="e.g. 5.0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Start Time (Optional)</label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">End Time (Optional)</label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleInputChange}
                className="w-full bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-semibold text-white">Services Offered</h2>
          
          {availableServices.length === 0 && formData.category === 'other' && (
            <p className="text-sm text-slate-400 italic">Add your custom services below for this new category.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {availableServices.map((service) => (
              <div key={service} className="relative group">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors w-full ${services[service] ? 'bg-blue-900/30 border-blue-500/50 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                    checked={!!services[service]}
                    onChange={() => handleServiceChange(service)}
                  />
                  <span className="text-sm font-medium truncate pr-6">{service}</span>
                </label>
                {!(DEFAULT_SERVICES[formData.category] || []).includes(service) && (
                  <button
                    type="button"
                    onClick={() => removeService(service)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/50">
            <input
              type="text"
              value={customServiceInput}
              onChange={(e) => setCustomServiceInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomService())}
              className="flex-1 bg-[#0F172A]/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner text-sm"
              placeholder="Type a custom service..."
            />
            <button
              type="button"
              onClick={handleAddCustomService}
              disabled={!customServiceInput.trim()}
              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-4 py-2 rounded-xl font-medium transition-colors border border-blue-500/30 disabled:opacity-50 disabled:border-slate-700 disabled:text-slate-500 disabled:bg-slate-800 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLocating}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-8 text-lg"
        >
          {isSubmitting ? (
            <><Loader2 className="w-6 h-6 animate-spin" /> Saving to Database...</>
          ) : (
            'Add Artisan'
          )}
        </button>

      </form>
    </div>
  );
}
