import { useState, useEffect } from 'react';
import { Loader2, Trash2, Edit, X, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ManageArtisansTab({ adminPin }: { adminPin: string }) {
  const [artisans, setArtisans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit State
  const [editingArtisan, setEditingArtisan] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchArtisans = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/artisans/all`, {
        headers: { 'x-admin-pin': adminPin }
      });
      if (!res.ok) throw new Error('Failed to fetch artisans');
      const data = await res.json();
      setArtisans(data);
    } catch (error) {
      toast.error('Failed to load artisans');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArtisans();
  }, [adminPin]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/artisans/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': adminPin }
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Artisan deleted successfully');
      setArtisans(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      toast.error('Failed to delete artisan');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Convert services back to array if it's a string
    const payload = { ...editingArtisan };
    if (typeof payload.services === 'string') {
      payload.services = payload.services.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/artisans/${editingArtisan.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin 
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to update');
      const { data } = await res.json();
      toast.success('Artisan updated successfully!');
      
      // Update local state
      setArtisans(prev => prev.map(a => a.id === data.id ? data : a));
      setEditingArtisan(null);
    } catch (error) {
      toast.error('Failed to update artisan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full relative">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Artisans</h1>
          <p className="text-slate-400">View, edit, or remove service providers</p>
        </div>
        <button onClick={fetchArtisans} className="text-sm text-blue-400 hover:text-blue-300">Refresh</button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-[#0F172A]/90 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-slate-900/50 text-slate-300 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Business Name</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {artisans.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">No artisans found.</td>
                  </tr>
                ) : (
                  artisans.map(artisan => (
                    <tr key={artisan.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{artisan.business_name}</div>
                        <div className="text-xs text-slate-500">{artisan.owner_name}</div>
                      </td>
                      <td className="px-6 py-4 capitalize">{artisan.category}</td>
                      <td className="px-6 py-4">{artisan.phone || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <button 
                            onClick={() => {
                              // Deep copy to avoid mutating original state before save
                              const copy = JSON.parse(JSON.stringify(artisan));
                              // Convert services array to comma-separated string for editing
                              if (Array.isArray(copy.services)) {
                                copy.services = copy.services.join(', ');
                              }
                              setEditingArtisan(copy);
                            }} 
                            className="text-blue-400 hover:text-blue-300 transition-colors" 
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(artisan.id, artisan.business_name)} className="text-red-400 hover:text-red-300 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal Overlay */}
      {editingArtisan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl relative max-h-[90vh] flex flex-col">
            
            {/* Sticky Header inside Modal */}
            <div className="flex justify-between items-center p-5 sm:p-8 pb-4 border-b border-slate-800 shrink-0">
              <h2 className="text-2xl font-bold text-white pr-4">Edit Artisan</h2>
              <button 
                onClick={() => setEditingArtisan(null)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-8 overflow-y-auto">
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Business Name</label>
                    <input 
                      type="text" required 
                      value={editingArtisan.business_name || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, business_name: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Owner Name</label>
                    <input 
                      type="text" required 
                      value={editingArtisan.owner_name || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, owner_name: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  
                  {/* Contact */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                    <input 
                      type="tel" required 
                      value={editingArtisan.phone || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, phone: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Address</label>
                    <input 
                      type="text" required 
                      value={editingArtisan.address || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, address: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  
                  {/* Categorization */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                    <select 
                      value={editingArtisan.category || 'vulcanizer'} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, category: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    >
                      <option value="vulcanizer">Vulcanizer</option>
                      <option value="mechanic">Mechanic</option>
                      <option value="towing">Towing Service</option>
                      <option value="diagnostic">Diagnostic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Mobility Type</label>
                    <select 
                      value={editingArtisan.mobility_type || 'stationary'} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, mobility_type: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    >
                      <option value="stationary">Stationary</option>
                      <option value="mobile">Mobile</option>
                      <option value="both">Both</option>
                    </select>
                  </div>

                  {/* Rating & Sound */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Rating (1-5)</label>
                    <input 
                      type="number" min="1" max="5" step="0.1"
                      value={editingArtisan.rating || 5.0} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, rating: parseFloat(e.target.value)})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Sound Signal (Optional)</label>
                    <input 
                      type="text" 
                      value={editingArtisan.sound_signal || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, sound_signal: e.target.value})}
                      placeholder="e.g. 3 honks"
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Start Time (Optional)</label>
                    <input 
                      type="time" 
                      value={editingArtisan.start_time || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, start_time: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">End Time (Optional)</label>
                    <input 
                      type="time" 
                      value={editingArtisan.end_time || ''} 
                      onChange={(e) => setEditingArtisan({...editingArtisan, end_time: e.target.value})}
                      className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Services (comma separated)</label>
                  <input 
                    type="text" required 
                    value={editingArtisan.services || ''} 
                    onChange={(e) => setEditingArtisan({...editingArtisan, services: e.target.value})}
                    placeholder="e.g. Tire patching, Engine diagnostic"
                    className="w-full bg-[#1E293B] border border-slate-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                </div>
                
                <div className="flex items-center gap-3 pt-2 pb-4">
                  <input 
                    type="checkbox" 
                    id="is_open"
                    checked={editingArtisan.is_open || false} 
                    onChange={(e) => setEditingArtisan({...editingArtisan, is_open: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-700 text-blue-500 focus:ring-blue-500/50 bg-[#1E293B]"
                  />
                  <label htmlFor="is_open" className="text-sm font-medium text-white">Currently Open</label>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingArtisan(null)}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-white hover:bg-slate-800 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
