import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PlayerSkinId = 'boy' | 'girl';

export interface PlayerSkinColors {
  primary: number; // 0xRRGGBB
  secondary: number; // 0xRRGGBB
}

export interface PlayerSkinConfig {
  headType?: 'cube' | 'rounded' | 'capsule';
  bodyType?: 'slim' | 'normal' | 'bulk';
  limbStyle?: 'block' | 'cylinder';
  accessoryHat?: 'none' | 'cap' | 'topHat';
  accessoryBack?: 'none' | 'backpack' | 'cape';
  face?: { eyes?: 'dot' | 'cartoon' | 'robot'; mouth?: 'smile' | 'neutral' | 'none' };
}

interface PlayerSettingsState {
  skinId: PlayerSkinId;
  colors: PlayerSkinColors;
  config: PlayerSkinConfig;
  setSkinId: (id: PlayerSkinId) => void;
  setColors: (colors: Partial<PlayerSkinColors>) => void;
  setConfig: (config: Partial<PlayerSkinConfig>) => void;
}

export const usePlayerSettingsStore = create<PlayerSettingsState>()(
  persist(
    (set, get) => ({
      skinId: 'boy',
      colors: {
        primary: 0x3B82F6, // blue-500
        secondary: 0x60A5FA, // blue-400
      },
      config: {
        headType: 'cube',
        bodyType: 'normal',
        limbStyle: 'block',
        accessoryHat: 'none',
        accessoryBack: 'none',
        face: { eyes: 'dot', mouth: 'smile' },
      },
      setSkinId: (id) => set({ skinId: id }),
      setColors: (colors) => set((s) => ({ colors: { ...s.colors, ...colors } })),
      setConfig: (config) => set((s) => ({ config: { ...s.config, ...config, face: { ...s.config.face, ...config.face } } })),
    }),
    {
      name: 'player-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ skinId: state.skinId, colors: state.colors, config: state.config }),
      version: 3,
      migrate: (persisted: any, fromVersion: number) => {
        const defaults = {
          skinId: 'blocky',
          colors: { primary: 0x3B82F6, secondary: 0x60A5FA },
          config: {
            headType: 'cube',
            bodyType: 'normal',
            limbStyle: 'block',
            accessoryHat: 'none',
            accessoryBack: 'none',
            face: { eyes: 'dot', mouth: 'smile' },
          },
        };
        if (!persisted || typeof persisted !== 'object') return defaults;
        const normalizeHex = (v: any, fallback: number) => {
          if (typeof v === 'number' && Number.isFinite(v)) return (v >>> 0) & 0xffffff;
          if (typeof v === 'string') {
            try {
              const s = v.trim();
              const hex = s.startsWith('#') ? s.slice(1) : s.startsWith('0x') ? s.slice(2) : s;
              const n = parseInt(hex, 16);
              if (Number.isFinite(n)) return (n >>> 0) & 0xffffff;
            } catch {}
          }
          return fallback;
        };
        const skinId = typeof persisted.skinId === 'string' ? persisted.skinId : defaults.skinId;
        const colorsObj = (persisted.colors && typeof persisted.colors === 'object') ? persisted.colors : {};
        const primary = normalizeHex((colorsObj as any).primary, defaults.colors.primary);
        const secondary = normalizeHex((colorsObj as any).secondary, defaults.colors.secondary);
        const config = (() => {
          const c = (persisted as any).config || {};
          return {
            headType: ['cube','rounded','capsule'].includes(c.headType) ? c.headType : defaults.config.headType,
            bodyType: ['slim','normal','bulk'].includes(c.bodyType) ? c.bodyType : defaults.config.bodyType,
            limbStyle: ['block','cylinder'].includes(c.limbStyle) ? c.limbStyle : defaults.config.limbStyle,
            accessoryHat: ['none','cap','topHat'].includes(c.accessoryHat) ? c.accessoryHat : defaults.config.accessoryHat,
            accessoryBack: ['none','backpack','cape'].includes(c.accessoryBack) ? c.accessoryBack : defaults.config.accessoryBack,
            face: {
              eyes: ['dot','cartoon','robot'].includes(c.face?.eyes) ? c.face.eyes : defaults.config.face.eyes,
              mouth: ['smile','neutral','none'].includes(c.face?.mouth) ? c.face.mouth : defaults.config.face.mouth,
            },
          };
        })();
        return { skinId, colors: { primary, secondary }, config };
      },
    }
  )
);


