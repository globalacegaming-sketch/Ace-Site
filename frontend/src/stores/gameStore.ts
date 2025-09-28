import { create } from 'zustand';
import type { Game, Platform } from '../types';

interface GameState {
  games: Game[];
  platforms: Platform[];
  selectedGame: Game | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setGames: (games: Game[]) => void;
  setPlatforms: (platforms: Platform[]) => void;
  setSelectedGame: (game: Game | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  filterGamesByPlatform: (platformId: string) => Game[];
  searchGames: (query: string) => Game[];
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  platforms: [],
  selectedGame: null,
  isLoading: false,
  error: null,

  setGames: (games: Game[]) => set({ games }),
  
  setPlatforms: (platforms: Platform[]) => set({ platforms }),
  
  setSelectedGame: (game: Game | null) => set({ selectedGame: game }),
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  
  setError: (error: string | null) => set({ error }),
  
  filterGamesByPlatform: (platformId: string) => {
    const { games } = get();
    return games.filter(game => game.platform === platformId);
  },
  
  searchGames: (query: string) => {
    const { games } = get();
    const lowercaseQuery = query.toLowerCase();
    return games.filter(game => 
      game.name.toLowerCase().includes(lowercaseQuery) ||
      game.description?.toLowerCase().includes(lowercaseQuery) ||
      game.platform.toLowerCase().includes(lowercaseQuery)
    );
  },
}));
