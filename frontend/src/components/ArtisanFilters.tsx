import { CATEGORY_ICONS } from './CategoryIcons';

interface ArtisanFiltersProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeMobility: string;
  onMobilityChange: (mobility: string) => void;
  isNightShift?: boolean;
  showNightInfoPopover?: boolean;
  onToggleNightInfo?: () => void;
  isMobile?: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'vulcanizer', label: 'Vulcanizer' },
  { id: 'tailor', label: 'Tailor' },
  { id: 'cobbler', label: 'Cobbler' },
  { id: 'nail_cutter', label: 'Nails' },
  { id: 'barber', label: 'Barber' }
];

const MOBILITY_OPTIONS = [
  { id: 'all', labelDesktop: 'Any Mobility', labelMobile: 'Any' },
  { id: 'STATIC', labelDesktop: 'Fixed Shops', labelMobile: 'Shops' },
  { id: 'MOBILE', labelDesktop: 'Mobile/Walking', labelMobile: 'Mobile' }
];

export default function ArtisanFilters({
  activeCategory,
  onCategoryChange,
  activeMobility,
  onMobilityChange,
  isNightShift,
  showNightInfoPopover,
  onToggleNightInfo,
  isMobile = false
}: ArtisanFiltersProps) {
  if (isMobile) {
    return (
      <div className="px-4 pb-2 border-b border-slate-800 flex flex-col gap-2">
        {isNightShift && (
          <div className="flex justify-center mt-2 relative">
            <button
              onClick={onToggleNightInfo}
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
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${activeCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
            >
              <span>{CATEGORY_ICONS[cat.id]}</span> {cat.label}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-2 mb-2">
          <div className="bg-slate-800 p-1 rounded-full flex w-full">
            {MOBILITY_OPTIONS.map(mob => (
              <button
                key={mob.id}
                onClick={() => onMobilityChange(mob.id)}
                className={`flex-1 py-1 rounded-full text-xs font-medium transition-colors ${activeMobility === mob.id ? 'bg-slate-600 text-white' : 'text-slate-400'}`}
              >
                {mob.labelMobile}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4 hidden md:flex flex-col gap-2">
      {isNightShift && (
        <div className="flex justify-center mb-1 relative">
          <button
            onClick={onToggleNightInfo}
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
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${activeCategory === cat.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <span>{CATEGORY_ICONS[cat.id]}</span> {cat.label}
          </button>
        ))}
      </div>

      <div className="flex justify-center gap-2">
        <div className="bg-[#0F172A]/80 backdrop-blur-xl p-1.5 rounded-full border border-slate-700/50 shadow-xl flex">
          {MOBILITY_OPTIONS.map(mob => (
            <button
              key={mob.id}
              onClick={() => onMobilityChange(mob.id)}
              className={`px-4 py-1 rounded-full text-xs font-medium transition-colors ${activeMobility === mob.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {mob.labelDesktop}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
