import { create } from "zustand";

interface UIState {
  mobileMenuOpen: boolean;
  pageTitle: { pathname: string; title: string } | null;
  practiceActive: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setPageTitle: (pathname: string, title: string) => void;
  setPracticeActive: (active: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  pageTitle: null,
  practiceActive: false,
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  setPageTitle: (pathname, title) => set({ pageTitle: { pathname, title } }),
  setPracticeActive: (practiceActive) => set({ practiceActive }),
}));
