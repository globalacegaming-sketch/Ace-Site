import { create } from 'zustand';
import type { Banner, Feature, Promotion } from '../types';

interface ContentState {
  banners: Banner[];
  features: Feature[];
  promotions: Promotion[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setBanners: (banners: Banner[]) => void;
  setFeatures: (features: Feature[]) => void;
  setPromotions: (promotions: Promotion[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Getters
  getActiveBanners: () => Banner[];
  getActiveFeatures: () => Feature[];
  getActivePromotions: () => Promotion[];
  getBannerByOrder: (order: number) => Banner | undefined;
}

export const useContentStore = create<ContentState>((set, get) => ({
  banners: [],
  features: [],
  promotions: [],
  isLoading: false,
  error: null,

  setBanners: (banners: Banner[]) => set({ banners }),
  
  setFeatures: (features: Feature[]) => set({ features }),
  
  setPromotions: (promotions: Promotion[]) => set({ promotions }),
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  
  setError: (error: string | null) => set({ error }),
  
  getActiveBanners: () => {
    const { banners } = get();
    return banners
      .filter(banner => banner.status === 'active')
      .sort((a, b) => a.order_index - b.order_index);
  },
  
  getActiveFeatures: () => {
    const { features } = get();
    return features.filter(feature => feature.status === 'active');
  },
  
  getActivePromotions: () => {
    const { promotions } = get();
    const now = new Date();
    return promotions.filter(promo => 
      promo.status === 'active' && 
      new Date(promo.expiry_date) > now
    );
  },
  
  getBannerByOrder: (order: number) => {
    const { banners } = get();
    return banners.find(banner => banner.order_index === order);
  },
}));
