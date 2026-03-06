import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Auth store — JWT + user data, persisted to localStorage
// SECURITY NOTE: localStorage is readable by any JavaScript on the page.
// httpOnly cookies would eliminate this XSS vector, but require backend
// changes. For the current scope this trade-off is accepted; ensure a strict
// CSP is deployed to mitigate the risk.
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  walletAddress: string | null;
  karmaPoints: number;
  avatarUrl: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True once zustand has finished rehydrating from localStorage. */
  _hydrated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      _hydrated: false,

      setAuth: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'foodshi-auth',
      // Restore isAuthenticated from persisted token presence
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: !!(state.token && state.user),
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hydrated: true });
      },
    }
  )
);

// ---------------------------------------------------------------------------
// UI store — sidebar visibility and global loading state
// ---------------------------------------------------------------------------

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

// ---------------------------------------------------------------------------
// Geolocation store — browser GPS position and permission state
// ---------------------------------------------------------------------------

export type GeolocationPermission = 'granted' | 'denied' | 'prompt' | null;

interface GeolocationState {
  position: { lat: number; lng: number } | null;
  permission: GeolocationPermission;
  loading: boolean;
  error: string | null;
  /** Uses maximumAge: 60 s — suitable for display purposes. */
  requestLocation: () => void;
  /**
   * Always requests a fresh GPS fix (maximumAge: 0).
   * Use this for security-sensitive operations like donation confirm where
   * a stale cached position could bypass the proximity check.
   */
  requestFreshLocation: () => void;
  clearPosition: () => void;
}

export const useGeolocationStore = create<GeolocationState>()((set) => ({
  position: null,
  permission: null,
  loading: false,
  error: null,

  requestLocation: () => {
    if (!navigator.geolocation) {
      set({ error: 'Geolocation is not supported by your browser', loading: false });
      return;
    }
    set({ loading: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          permission: 'granted',
          loading: false,
          error: null,
        });
      },
      (err) => {
        set({
          permission: err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt',
          loading: false,
          error: err.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  },

  requestFreshLocation: () => {
    if (!navigator.geolocation) {
      set({ error: 'Geolocation is not supported by your browser', loading: false });
      return;
    }
    set({ loading: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          permission: 'granted',
          loading: false,
          error: null,
        });
      },
      (err) => {
        set({
          permission: err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt',
          loading: false,
          error: err.message,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  },

  clearPosition: () => set({ position: null }),
}));
