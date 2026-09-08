import { useState, useCallback } from 'react';
import type { Artisan } from '../App';

export interface UseArtisanFiltersReturn {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  activeMobility: string;
  setActiveMobility: (mobility: string) => void;
  filterArtisans: (artisans: Artisan[] | null) => Artisan[];
  resetFilters: () => void;
}

export function useArtisanFilters(
  initialCategory = 'all',
  initialMobility = 'all'
): UseArtisanFiltersReturn {
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [activeMobility, setActiveMobility] = useState<string>(initialMobility);

  const filterArtisans = useCallback(
    (artisans: Artisan[] | null): Artisan[] => {
      if (!artisans) return [];
      return artisans.filter((artisan) => {
        const matchesCategory =
          activeCategory === 'all' || artisan.category === activeCategory;
        const matchesMobility =
          activeMobility === 'all' || artisan.mobility_type === activeMobility;
        return matchesCategory && matchesMobility;
      });
    },
    [activeCategory, activeMobility]
  );

  const resetFilters = useCallback(() => {
    setActiveCategory('all');
    setActiveMobility('all');
  }, []);

  return {
    activeCategory,
    setActiveCategory,
    activeMobility,
    setActiveMobility,
    filterArtisans,
    resetFilters,
  };
}
