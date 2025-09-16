import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  ActiveLayer,
  VoxelKey,
  VoxelColor,
  makeKey,
  parseKey,
  createClampToBounds,
  createWorldToGrid as createWorldToGridUtil,
  chooseAxisFromNormal as chooseAxisFromNormalUtil,
  rectPositionsOnPlane as rectPositionsOnPlaneUtil,
  linePositionsAxisAligned as linePositionsAxisAlignedUtil,
  spherePositions as spherePositionsUtil,
  applyVoxelBatchGeneric,
} from '@/pages/skin-studio/lib/voxel-utils';
import { createRLEPayload, decodeVoxelsRLE } from '@/pages/skin-studio/lib/rle';
import { applyQualitySettings } from '@/pages/skin-studio/lib/quality';
import { setupSkinStudioCamera, enhanceCameraControls } from '@/pages/skin-studio/lib/camera';
import { createSkinMesh, type PlayerSkinColors } from '@/components/editor-enhanced/scene/systems/play/skins/registry';
import { usePlayerSettingsStore } from '@/features/player/store';
import type { PlayerSkinId } from '@/features/player/store';
import { useAuthStore } from '@/features/auth/store';
import { useToast } from '@/hooks/use-toast';
import { AuthService, SkinsService } from '@/services/api.service';
import {
  formatPrice,
  type SkinListingWithSkin,
  type SkinVisibilityFilter,
  type SkinWithListings,
} from '@/types/skins';
import type { UserProfile } from '@/types/profile';
import type {
  SkinStudioController,
  SkinStudioTab,
  QualitySetting,
  EditorMode,
  EditorTool,
  EditorBrush,
  AxisLock,
  SkinPreset,
  MarketplaceFilter,
  MarketplaceSort,
} from '../types';


const toHex = (n: number) => `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;

const fromHex = (value: string, fallback: number) => {
  try {
    const trimmed = value.trim();
    const normalized = trimmed.startsWith('#')
      ? trimmed.slice(1)
      : trimmed.startsWith('0x')
        ? trimmed.slice(2)
        : trimmed;
    const parsed = parseInt(normalized, 16);
    return Number.isFinite(parsed) ? ((parsed >>> 0) & 0xffffff) : fallback;
  } catch {
    return fallback;
  }
};

const DEFAULT_COLORS_BY_SKIN: Record<PlayerSkinId, { primary: string; secondary: string }> = {
  boy: { primary: '#3B82F6', secondary: '#60A5FA' },
  girl: { primary: '#E11D48', secondary: '#F472B6' },
};

const UNDO_LIMIT = 50;

type SkinPayloadMeta = {
  skinId?: PlayerSkinId;
  colors?: { primary?: string; secondary?: string };
};

type BusyMap = Record<string, boolean>;

type PaletteUpdater = (index: number, color: string) => void;

type ClampFn = ReturnType<typeof createClampToBounds>;

type WorldToGridFn = ReturnType<typeof createWorldToGridUtil>;

type RectPositionFn = ReturnType<typeof rectPositionsOnPlaneUtil>;

type LinePositionFn = ReturnType<typeof linePositionsAxisAlignedUtil>;

type SpherePositionFn = ReturnType<typeof spherePositionsUtil>;

type ChooseAxisFn = ReturnType<typeof chooseAxisFromNormalUtil>;

const parsePriceInput = (value: string): number | null => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
};


export const useSkinStudioController = (): SkinStudioController => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const rootRef = useRef<BABYLON.Mesh | null>(null);
  const dirLightRef = useRef<BABYLON.DirectionalLight | null>(null);
  const shadowGenRef = useRef<BABYLON.ShadowGenerator | null>(null);
  const pipelineRef = useRef<BABYLON.DefaultRenderingPipeline | null>(null);
  const groundRef = useRef<BABYLON.Mesh | null>(null);
  const beforeRenderObserverRef = useRef<BABYLON.Observer<any> | null>(null);
  const holoRootRef = useRef<BABYLON.TransformNode | null>(null);
  const scanRingRef = useRef<BABYLON.Mesh | null>(null);
  const scanPhaseRef = useRef<number>(0);

  const voxelRootRef = useRef<BABYLON.TransformNode | null>(null);
  const voxelPrimaryRef = useRef<BABYLON.Mesh | null>(null);
  const voxelSecondaryRef = useRef<BABYLON.Mesh | null>(null);
  const ghostRef = useRef<BABYLON.Mesh | null>(null);
  const pointerObserverRef = useRef<BABYLON.Observer<BABYLON.PointerInfo> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const dragAxisRef = useRef<'x' | 'y' | 'z'>('y');
  const gridRootRef = useRef<BABYLON.TransformNode | null>(null);
  const voxelsRef = useRef<Record<VoxelKey, VoxelColor>>({});
  const dragStartSnapshotRef = useRef<Record<VoxelKey, VoxelColor> | null>(null);
  const voxelPaletteMeshesRef = useRef<BABYLON.Mesh[]>([]);

  const storeSkinId = usePlayerSettingsStore((state) => state.skinId);
  const setSkinId = usePlayerSettingsStore((state) => state.setSkinId);
  const storeColors = usePlayerSettingsStore((state) => state.colors);
  const setColors = usePlayerSettingsStore((state) => state.setColors);
  const storeConfig = usePlayerSettingsStore((state) => (state as any).config);
  const setConfig = usePlayerSettingsStore((state) => (state as any).setConfig) as
    | ((config: unknown) => void)
    | undefined;
  const authUser = useAuthStore((state) => state.user);
  const authUpdateProfile = useAuthStore((state) => state.updateProfile);
  const { toast } = useToast();

  const [skinId, setLocalSkinId] = useState<PlayerSkinId>(storeSkinId);
  const [primaryHex, setPrimaryHex] = useState<string>(() => toHex(storeColors.primary));
  const [secondaryHex, setSecondaryHex] = useState<string>(() => toHex(storeColors.secondary));
  const [rotationSpeed, setRotationSpeed] = useState<number>(0.001);
  const [scale, setScale] = useState<number>(1);
  const [quality, setQuality] = useState<QualitySetting>('high');
  const [headType, setHeadType] = useState<'cube' | 'rounded' | 'capsule'>(storeConfig?.headType || 'cube');
  const [bodyType, setBodyType] = useState<'slim' | 'normal' | 'bulk'>(storeConfig?.bodyType || 'normal');
  const [limbStyle, setLimbStyle] = useState<'block' | 'cylinder'>(storeConfig?.limbStyle || 'block');
  const [hat, setHat] = useState<'none' | 'cap' | 'topHat'>(storeConfig?.accessoryHat || 'none');
  const [back, setBack] = useState<'none' | 'backpack' | 'cape'>(storeConfig?.accessoryBack || 'none');
  const [eyes, setEyes] = useState<'dot' | 'cartoon' | 'robot'>(storeConfig?.face?.eyes || 'dot');
  const [mouth, setMouth] = useState<'smile' | 'neutral' | 'none'>(storeConfig?.face?.mouth || 'smile');
  const [presets, setPresets] = useState<SkinPreset[]>(() => {
    try {
      const raw = localStorage.getItem('skin-presets');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<SkinStudioTab>('editor');
  const [mySkins, setMySkins] = useState<SkinWithListings[]>([]);
  const [mySkinsLoading, setMySkinsLoading] = useState<boolean>(false);
  const [mySkinsFetched, setMySkinsFetched] = useState<boolean>(false);
  const [mySkinsFilter, setMySkinsFilter] = useState<SkinVisibilityFilter>('all');
  const [mySkinsSearch, setMySkinsSearch] = useState<string>('');
  const [newSkinName, setNewSkinName] = useState<string>('');

  const [marketplaceListings, setMarketplaceListings] = useState<SkinListingWithSkin[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState<boolean>(false);
  const [marketplaceFetched, setMarketplaceFetched] = useState<boolean>(false);
  const [marketplaceSearch, setMarketplaceSearch] = useState<string>('');
  const [marketplaceSort, setMarketplaceSort] = useState<MarketplaceSort>('recent');
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>('available');

  const [busyActions, setBusyActions] = useState<BusyMap>({});

  const [mode, setMode] = useState<EditorMode>('preview');
  const [tool, setTool] = useState<EditorTool>('add');
  const [brush, setBrush] = useState<EditorBrush>('point');
  const [axisLock, setAxisLock] = useState<AxisLock>('auto');
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('all');
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);
  const [mirrorX, setMirrorX] = useState<boolean>(false);
  const [showBaseModel, setShowBaseModel] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToSegments, setSnapToSegments] = useState<boolean>(true);
  const [voxelSize] = useState<number>(0.1);
  const [voxelBounds] = useState<{ x: number; y: number; z: number }>({ x: 16, y: 24, z: 12 });
  const [brushRadius, setBrushRadius] = useState<number>(2);
  const [voxels, setVoxels] = useState<Record<VoxelKey, VoxelColor>>(() => {
    try {
      const raw = localStorage.getItem('skin-voxels');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed || {};
    } catch {
      return {};
    }
  });
  const [undoStack, setUndoStack] = useState<Record<VoxelKey, VoxelColor>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<VoxelKey, VoxelColor>[]>([]);


  const setActionBusy = useCallback((key: string, busy: boolean) => {
    setBusyActions((prev) => {
      if (busy) {
        if (prev[key]) return prev;
        return { ...prev, [key]: true };
      }
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const isActionBusy = useCallback((key: string) => !!busyActions[key], [busyActions]);

  const runWithBusy = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setActionBusy(key, true);
      try {
        await fn();
      } finally {
        setActionBusy(key, false);
      }
    },
    [setActionBusy],
  );

  const captureThumbnail = useCallback(async (): Promise<string | undefined> => {
    if (typeof window === 'undefined') return undefined;
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas) return undefined;
    try {
      scene?.render();
    } catch {}
    await new Promise<void>((resolve) => {
      try {
        requestAnimationFrame(() => resolve());
      } catch {
        resolve();
      }
    });
    try {
      const size = 256;
      const target = document.createElement('canvas');
      target.width = size;
      target.height = size;
      const ctx = target.getContext('2d');
      if (!ctx) return canvas.toDataURL('image/png');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(canvas, 0, 0, size, size);
      return target.toDataURL('image/png');
    } catch {
      try {
        return canvas.toDataURL('image/png');
      } catch {
        return undefined;
      }
    }
  }, []);

  const refreshMySkins = useCallback(async () => {
    if (!authUser) {
      setMySkins([]);
      setMySkinsFetched(false);
      return;
    }
    setMySkinsLoading(true);
    try {
      const response = await SkinsService.getMySkins();
      setMySkins(response.skins || []);
    } catch (error: any) {
      toast({
        title: 'Failed to fetch skins',
        description: error?.message || 'Spróbuj ponownie pózniej.',
        variant: 'destructive',
      });
    } finally {
      setMySkinsLoading(false);
      setMySkinsFetched(true);
    }
  }, [authUser, toast]);

  const refreshMarketplace = useCallback(async () => {
    setMarketplaceLoading(true);
    try {
      const response = await SkinsService.getListings();
      setMarketplaceListings(response.listings || []);
    } catch (error: any) {
      toast({
        title: 'Failed to fetch marketplace',
        description: error?.message || 'Spróbuj ponownie pózniej.',
        variant: 'destructive',
      });
    } finally {
      setMarketplaceLoading(false);
      setMarketplaceFetched(true);
    }
  }, [toast]);

  const loadSkinFromPayload = useCallback(
    (payloadString: string): SkinPayloadMeta | null => {
      try {
        const parsed = JSON.parse(payloadString);
        const rle = parsed?.voxelsRLE && parsed?.bounds ? parsed : parsed?.rle;
        if (!rle || !Array.isArray(rle.voxelsRLE) || !rle.bounds) {
          throw new Error('Brak voxeli');
        }
        const decoded = decodeVoxelsRLE(rle.voxelsRLE, rle.bounds);
        setVoxels(decoded as Record<VoxelKey, VoxelColor>);
        if (Array.isArray(rle.palette)) {
          setPalette(rle.palette);
        }
        setUndoStack([]);
        setRedoStack([]);
        return {
          skinId: parsed?.skinId || parsed?.meta?.skinId,
          colors: parsed?.colors || parsed?.meta?.colors,
        };
      } catch (error: any) {
        toast({
          title: 'Failed to load skin',
          description: error?.message || 'Invalid data format.',
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast],
  );

  const handleLoadSkinRecord = useCallback(
    (skin: SkinWithListings) => {
      const meta = loadSkinFromPayload(skin.data);
      if (meta?.skinId) setLocalSkinId(meta.skinId);
      if (meta?.colors?.primary) setPrimaryHex(meta.colors.primary);
      if (meta?.colors?.secondary) setSecondaryHex(meta.colors.secondary);
      setActiveTab('editor');
    },
    [loadSkinFromPayload],
  );

  const handleApplySkinFromEditor = useCallback(
    async (skin: SkinWithListings) => {
      const meta = loadSkinFromPayload(skin.data);
      if (meta?.skinId) setLocalSkinId(meta.skinId);
      if (meta?.colors?.primary) setPrimaryHex(meta.colors.primary);
      if (meta?.colors?.secondary) setSecondaryHex(meta.colors.secondary);
      const primary = meta?.colors?.primary
        ? fromHex(meta.colors.primary, storeColors.primary)
        : fromHex(primaryHex, storeColors.primary);
      const secondary = meta?.colors?.secondary
        ? fromHex(meta.colors.secondary, storeColors.secondary)
        : fromHex(secondaryHex, storeColors.secondary);
      setSkinId(skinId);
      setColors({ primary, secondary });
      try {
        if (authUser) {
          await authUpdateProfile({
            skinId: skinId,
            skinPrimary: primary,
            skinSecondary: secondary,
          } as any);
        }
        toast({ title: 'Skin applied', description: 'Skin has been applied.' });
      } catch (error: any) {
        toast({
          title: 'Failed to apply skin',
          description: error?.message || 'Spróbuj ponownie pózniej.',
          variant: 'destructive',
        });
      }
      setActiveTab('editor');
    },
    [
      loadSkinFromPayload,
      storeColors.primary,
      storeColors.secondary,
      primaryHex,
      secondaryHex,
      setSkinId,
      setColors,
      skinId,
      authUser,
      authUpdateProfile,
      toast,
    ],
  );


  useEffect(() => {
    if (authUser) {
      refreshMySkins();
    } else {
      setMySkins([]);
      setMySkinsFetched(false);
    }
  }, [authUser, refreshMySkins]);

  useEffect(() => {
    if (activeTab === 'library' && authUser && !mySkinsFetched) {
      refreshMySkins();
    }
  }, [activeTab, authUser, mySkinsFetched, refreshMySkins]);

  useEffect(() => {
    if (!marketplaceFetched) {
      refreshMarketplace();
    }
  }, [marketplaceFetched, refreshMarketplace]);

  useEffect(() => {
    if (activeTab === 'marketplace' && !marketplaceFetched) {
      refreshMarketplace();
    }
  }, [activeTab, marketplaceFetched, refreshMarketplace]);

  useEffect(() => {
    voxelsRef.current = voxels;
  }, [voxels]);

  const [palette, setPalette] = useState<string[]>(() => {
    const primary = toHex(storeColors.primary);
    const secondary = toHex(storeColors.secondary);
    return [
      primary,
      secondary,
      '#FFD166',
      '#EF476F',
      '#06D6A0',
      '#118AB2',
      '#073B4C',
      '#A78BFA',
      '#F59E0B',
      '#10B981',
      '#3B82F6',
      '#F97316',
      '#E11D48',
      '#14B8A6',
      '#22C55E',
      '#8B5CF6',
    ];
  });

  useEffect(() => {
    setPalette((prev) => {
      const next = prev.slice();
      next[0] = primaryHex;
      return next;
    });
  }, [primaryHex]);

  useEffect(() => {
    setPalette((prev) => {
      const next = prev.slice();
      next[1] = secondaryHex;
      return next;
    });
  }, [secondaryHex]);

  const colorsMemo: PlayerSkinColors = useMemo(
    () => ({
      primary: BABYLON.Color3.FromHexString(primaryHex),
      secondary: BABYLON.Color3.FromHexString(secondaryHex),
    }),
    [primaryHex, secondaryHex],
  );

  const kogamaConfig = useMemo(
    () => ({
      headType,
      bodyType,
      limbStyle,
      accessoryHat: hat,
      accessoryBack: back,
      face: { eyes, mouth },
    }),
    [headType, bodyType, limbStyle, hat, back, eyes, mouth],
  );

  useEffect(() => {
    if (typeof setConfig === 'function') {
      try {
        setConfig(kogamaConfig);
      } catch {}
    }
  }, [kogamaConfig, setConfig]);


  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: false,
      alpha: true,
    });
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;
    try {
      (scene as any).clearColor = new (BABYLON as any).Color4(0, 0, 0, 0);
    } catch {}

    const camera = setupSkinStudioCamera(scene, canvasRef.current);
    try {
      scene.activeCamera = camera;
    } catch {}
    enhanceCameraControls(camera, scene, canvasRef.current);

    const hemi = new BABYLON.HemisphericLight('h1', new BABYLON.Vector3(1, 1, 0), scene);
    hemi.intensity = 0.6;
    const light = new BABYLON.DirectionalLight('d1', new BABYLON.Vector3(-1, -2, -1), scene);
    light.position = new BABYLON.Vector3(4, 6, 4);
    light.intensity = 0.9;
    dirLightRef.current = light;
    try {
      light.shadowMinZ = 1;
      light.shadowMaxZ = 20;
    } catch {}

    const ground = BABYLON.MeshBuilder.CreateGround('g', { width: 16, height: 16 }, scene);
    const groundMat = new BABYLON.PBRMaterial('gmat', scene);
    groundMat.metallic = 0;
    groundMat.roughness = 1;
    groundMat.albedoColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    ground.material = groundMat;
    (ground as any).receiveShadows = true;
    groundRef.current = ground as BABYLON.Mesh;

    try {
      const sg = new BABYLON.ShadowGenerator(1024, light);
      const map = sg.getShadowMap();
      if (map) map.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
      sg.useBlurExponentialShadowMap = true;
      sg.blurKernel = 16;
      shadowGenRef.current = sg;
    } catch {}

    try {
      const pipeline = new BABYLON.DefaultRenderingPipeline('skinStudioPipeline', true, scene, [camera]);
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = false;
      pipeline.samples = 1;
      pipelineRef.current = pipeline;
    } catch {}

    try {
      const holoRoot = new BABYLON.TransformNode('holo_root', scene);
      holoRootRef.current = holoRoot;

      const dome = BABYLON.MeshBuilder.CreateSphere(
        'holo_dome',
        { diameter: 40, segments: 48, sideOrientation: BABYLON.Mesh.BACKSIDE },
        scene,
      );
      dome.parent = holoRoot;
      const domeMat = new BABYLON.StandardMaterial('holo_dome_mat', scene);
      domeMat.emissiveColor = new BABYLON.Color3(0.2, 0.6, 1.0);
      domeMat.alpha = 0.08;
      dome.material = domeMat;
      dome.isPickable = false;

      const cube = BABYLON.MeshBuilder.CreateBox('holo_cube', { size: 32 }, scene);
      cube.parent = holoRoot;
      const cubeMat = new BABYLON.StandardMaterial('holo_cube_mat', scene);
      cubeMat.emissiveColor = new BABYLON.Color3(0.2, 0.6, 1.0);
      cubeMat.alpha = 0.12;
      cubeMat.wireframe = true;
      cube.material = cubeMat;
      cube.isPickable = false;

      const ring = BABYLON.MeshBuilder.CreateTorus('holo_ring', { diameter: 5.2, thickness: 0.01, tessellation: 64 }, scene);
      ring.parent = holoRoot;
      ring.rotation.x = Math.PI / 2;
      const ringMat = new BABYLON.StandardMaterial('holo_ring_mat', scene);
      ringMat.emissiveColor = new BABYLON.Color3(0.3, 0.8, 1.0);
      ringMat.alpha = 0.5;
      ring.material = ringMat;
      ring.isPickable = false;
      scanRingRef.current = ring;

      for (let i = 0; i < 4; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(holo_grid_, { width: 30, height: 30 }, scene);
        plane.parent = holoRoot;
        plane.position.y = 0;
        plane.rotation.y = i * Math.PI / 4;
        const planeMat = new BABYLON.StandardMaterial(holo_grid_mat_, scene);
        planeMat.wireframe = true;
        planeMat.emissiveColor = new BABYLON.Color3(0.15, 0.5, 1.0);
        planeMat.alpha = 0.04;
        plane.material = planeMat;
        plane.isPickable = false;
      }

      try {
        const glow = new BABYLON.GlowLayer('holo_glow', scene, { blurKernelSize: 32 });
        (glow as any).intensity = 0.35;
      } catch {}
    } catch {}

    try {
      const voxelRoot = new BABYLON.TransformNode('voxel_root', scene);
      voxelRootRef.current = voxelRoot;
      const makeMaterial = (name: string, color: BABYLON.Color3) => {
        const material = new BABYLON.PBRMaterial(name, scene);
        material.metallic = 0;
        material.roughness = 0.8;
        material.albedoColor = color;
        return material;
      };
      const base = BABYLON.MeshBuilder.CreateBox('voxel_base', { size: 1 }, scene);
      base.isVisible = false;
      base.isPickable = false;
      base.parent = voxelRoot;
      const paletteMeshes: BABYLON.Mesh[] = [];
      for (let i = 0; i < 16; i++) {
        const mesh = base.clone(oxel_pal_) as BABYLON.Mesh;
        mesh.isVisible = true;
        mesh.isPickable = true;
        const hex = palette[i] || '#ffffff';
        mesh.material = makeMaterial(oxel_mat_, BABYLON.Color3.FromHexString(hex));
        paletteMeshes.push(mesh);
      }
      voxelPaletteMeshesRef.current = paletteMeshes;
      voxelPrimaryRef.current = paletteMeshes[0];
      voxelSecondaryRef.current = paletteMeshes[1];

      const ghost = BABYLON.MeshBuilder.CreateBox('voxel_ghost', { size: 1 }, scene);
      const ghostMaterial = new BABYLON.StandardMaterial('voxel_ghost_mat', scene);
      try {
        ghostMaterial.diffuseColor = BABYLON.Color3.FromHexString(palette[0]);
      } catch {
        ghostMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
      }
      ghostMaterial.alpha = 0.35;
      ghost.material = ghostMaterial;
      ghost.isPickable = false;
      ghost.setEnabled(false);
      ghostRef.current = ghost;
    } catch {}

    try {
      const gridRoot = new BABYLON.TransformNode('grid_root', scene);
      gridRootRef.current = gridRoot;
      const makeWireMaterial = (name: string, color: BABYLON.Color3) => {
        const material = new BABYLON.StandardMaterial(name, scene);
        material.emissiveColor = color;
        material.diffuseColor = color;
        material.specularColor = BABYLON.Color3.Black();
        material.wireframe = true;
        return material;
      };
      const fullWidth = voxelBounds.x * voxelSize;
      const fullDepth = voxelBounds.z * voxelSize;
      const addSegment = (id: string, yMin: number, yMax: number, color: BABYLON.Color3) => {
        const height = (yMax - yMin + 1) * voxelSize;
        const box = BABYLON.MeshBuilder.CreateBox(id, { width: fullWidth, height, depth: fullDepth }, scene);
        box.material = makeWireMaterial(${id}_mat, color);
        box.isPickable = false;
        box.position = new BABYLON.Vector3(0, (yMin + yMax + 1) * 0.5 * voxelSize, 0);
        box.parent = gridRoot;
      };
      addSegment('grid_legs', 0, 7, new BABYLON.Color3(0.2, 0.8, 0.2));
      addSegment('grid_torso', 8, 15, new BABYLON.Color3(0.2, 0.6, 1.0));
      addSegment('grid_head', 16, 23, new BABYLON.Color3(1.0, 0.6, 0.2));
      gridRoot.setEnabled(false);
    } catch {}

    try {
      engine.stopRenderLoop();
    } catch {}
    engine.runRenderLoop(() => {
      try {
        scene.render();
      } catch {}
    });
    try {
      engine.resize();
    } catch {}

    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      try {
        engine.stopRenderLoop();
      } catch {}
      try {
        scene.dispose();
      } catch {}
      try {
        engine.dispose();
      } catch {}
      sceneRef.current = null;
      engineRef.current = null;
      rootRef.current = null;
      shadowGenRef.current = null;
      pipelineRef.current = null;
      dirLightRef.current = null;
      groundRef.current = null;
      voxelRootRef.current = null;
      voxelPrimaryRef.current = null;
      voxelSecondaryRef.current = null;
      ghostRef.current = null;
      gridRootRef.current = null;
    };
  }, [palette, voxelBounds, voxelSize]);

  useEffect(() => {
    const grid = gridRootRef.current;
    if (!grid) return;
    try {
      grid.setEnabled(showGrid && mode === 'edit');
    } catch {}
  }, [showGrid, mode]);

  useEffect(() => {
    const grid = gridRootRef.current;
    if (!grid) return;
    const children = (grid.getChildren() as BABYLON.AbstractMesh[]) || [];
    children.forEach((child) => {
      try {
        const material = (child as any).material as BABYLON.StandardMaterial;
        const id = child.name || '';
        const isActive =
          activeLayer === 'all' ||
          (activeLayer === 'legs' && id.includes('legs')) ||
          (activeLayer === 'torso' && id.includes('torso')) ||
          (activeLayer === 'head' && id.includes('head'));
        material.alpha = isActive ? 0.8 : 0.18;
      } catch {}
    });
  }, [activeLayer]);

  useEffect(() => {
    const engine = engineRef.current;
    const scene = sceneRef.current;
    if (!engine || !scene) return;
    applyQualitySettings(engine, scene, shadowGenRef.current, pipelineRef.current, quality);
  }, [quality]);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const meshes = voxelPaletteMeshesRef.current;
    if (!meshes || meshes.length === 0) return;

    meshes.forEach((mesh, index) => {
      try {
        const material = mesh.material as BABYLON.PBRMaterial;
        material.albedoColor = BABYLON.Color3.FromHexString(palette[index]);
      } catch {}
      try {
        mesh.isVisible = true;
      } catch {}
    });

    const transforms: number[][] = Array.from({ length: 16 }, () => []);
    const size = voxelSize;
    const addTransform = (arr: number[], x: number, y: number, z: number) => {
      const matrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(size, size, size),
        BABYLON.Quaternion.Identity(),
        new BABYLON.Vector3(x * size, y * size, z * size),
      );
      matrix.copyToArray(arr, arr.length);
    };

    Object.entries(voxels).forEach(([key, color]) => {
      const { x, y, z } = parseKey(key);
      let index: number | null = null;
      if (typeof color === 'number') {
        index = Math.max(0, Math.min(15, color));
      } else if (color === 'primary') {
        index = 0;
      } else if (color === 'secondary') {
        index = 1;
      }
      if (index !== null) addTransform(transforms[index], x, y, z);
    });

    for (let i = 0; i < meshes.length; i++) {
      try {
        meshes[i].thinInstanceSetBuffer('matrix', new Float32Array(transforms[i]), 16, true);
      } catch {}
    }
  }, [voxels, palette, voxelSize]);

  useEffect(() => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    try {
      (ghost.material as BABYLON.StandardMaterial).diffuseColor = BABYLON.Color3.FromHexString(
        palette[selectedColorIndex],
      );
    } catch {}
  }, [selectedColorIndex, palette]);

  const clampToBounds = useMemo<ClampFn>(() => createClampToBounds(voxelBounds), [voxelBounds]);
  const worldToGrid = useMemo<WorldToGridFn>(() => createWorldToGridUtil(voxelSize, voxelBounds), [
    voxelSize,
    voxelBounds,
  ]);
  const gridToWorld = useCallback((x: number, y: number, z: number) => new BABYLON.Vector3(x * voxelSize, y * voxelSize, z * voxelSize), [voxelSize]);
  const chooseAxisFromNormal = useMemo<ChooseAxisFn>(() => chooseAxisFromNormalUtil as ChooseAxisFn, []);
  const rectPositionsOnPlane = useMemo<RectPositionFn>(() => rectPositionsOnPlaneUtil as RectPositionFn, []);
  const linePositionsAxisAligned = useMemo<LinePositionFn>(() => linePositionsAxisAlignedUtil as LinePositionFn, []);
  const spherePositions = useMemo<SpherePositionFn>(() => spherePositionsUtil as SpherePositionFn, []);

  const getLayerRange = useCallback(
    (layer: ActiveLayer, yHint?: number): { min: number; max: number } => {
      if (layer === 'all') {
        const y = Math.max(0, Math.min(voxelBounds.y - 1, yHint ?? 0));
        if (y <= 7) return { min: 0, max: 7 };
        if (y <= 15) return { min: 8, max: 15 };
        return { min: 16, max: 23 };
      }
      const map: Record<Exclude<ActiveLayer, 'all'>, { min: number; max: number }> = {
        legs: { min: 0, max: 7 },
        torso: { min: 8, max: 15 },
        head: { min: 16, max: 23 },
      } as const;
      return map[layer as Exclude<ActiveLayer, 'all'>];
    },
    [voxelBounds],
  );

  const getLayerMid = useCallback((range: { min: number; max: number }) => Math.floor((range.min + range.max) / 2), []);

  const applyVoxelBatch = useCallback(
    (positions: Array<{ x: number; y: number; z: number }>, action: 'set' | 'remove', color: VoxelColor) => {
      if (positions.length === 0) return;
      setVoxels((prev) =>
        applyVoxelBatchGeneric(prev, positions, action, color, {
          activeLayer,
          mirrorX,
          bounds: voxelBounds,
        }),
      );
    },
    [activeLayer, mirrorX, voxelBounds],
  );

  const setVoxel = useCallback(
    (x: number, y: number, z: number, color: VoxelColor) => {
      const { x: cx, y: cy, z: cz } = clampToBounds(x, y, z);
      const key = makeKey(cx, cy, cz);
      setVoxels((prev) => {
        const next = { ...prev, [key]: color };
        if (mirrorX) {
          next[makeKey(-cx, cy, cz)] = color;
        }
        return next;
      });
    },
    [clampToBounds, mirrorX],
  );

  const removeVoxel = useCallback(
    (x: number, y: number, z: number) => {
      const { x: cx, y: cy, z: cz } = clampToBounds(x, y, z);
      const key = makeKey(cx, cy, cz);
      setVoxels((prev) => {
        const next = { ...prev };
        delete next[key];
        if (mirrorX) delete next[makeKey(-cx, cy, cz)];
        return next;
      });
    },
    [clampToBounds, mirrorX],
  );
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (pointerObserverRef.current) {
      try {
        scene.onPointerObservable.remove(pointerObserverRef.current);
      } catch {}
      pointerObserverRef.current = null;
    }
    if (mode !== 'edit') {
      if (ghostRef.current) ghostRef.current.setEnabled(false);
      return;
    }
    const observer = scene.onPointerObservable.add((pointerInfo) => {
      if (!scene) return;
      const ghost = ghostRef.current;
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        const pick = scene.pick(scene.pointerX, scene.pointerY);
        if (pick && pick.hit && ghost) {
          let point = pick.pickedPoint?.clone() || new BABYLON.Vector3(0, 0, 0);
          if (pick.getNormal) {
            const normal = pick.getNormal(true);
            const isVoxelMesh = !!(pick.pickedMesh && voxelPaletteMeshesRef.current.includes(pick.pickedMesh as BABYLON.Mesh));
            if (normal && isVoxelMesh) {
              point = point.add(normal.scale(voxelSize * 0.5 + 1e-3));
            }
          }
          let gridPoint = worldToGrid(point);
          if (snapToSegments) {
            const axis: 'x' | 'y' | 'z' = axisLock !== 'auto' ? axisLock : dragAxisRef.current;
            if (axis === 'y') {
              const range = getLayerRange(activeLayer, gridPoint.y);
              gridPoint.y = getLayerMid(range);
            }
          }
          ghost.scaling.setAll(voxelSize);
          ghost.position.copyFrom(gridToWorld(gridPoint.x, gridPoint.y, gridPoint.z));
          ghost.setEnabled(true);
          if (isDraggingRef.current && dragStartRef.current) {
            const start = dragStartRef.current;
            const current = gridPoint;
            const axis: 'x' | 'y' | 'z' = axisLock !== 'auto' ? axisLock : dragAxisRef.current;
            let positions: Array<{ x: number; y: number; z: number }> = [];
            if (brush === 'line') positions = linePositionsAxisAligned(start, current, axis);
            else if (brush === 'rect') positions = rectPositionsOnPlane(start, current, axis);
            else if (brush === 'sphere')
              positions = spherePositions(current, Math.max(1, Math.floor(brushRadius)));
            else positions = [current];
            applyVoxelBatch(positions, tool === 'remove' ? 'remove' : 'set', selectedColorIndex);
          }
        } else if (ghost) {
          ghost.setEnabled(false);
        }
      }
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        if ((pointerInfo.event as PointerEvent).button !== 0) return;
        const pick = scene.pick(scene.pointerX, scene.pointerY);
        if (!pick || !pick.hit || !pick.pickedPoint) return;
        let point = pick.pickedPoint.clone();
        if (pick.getNormal) {
          const normal = pick.getNormal(true);
          const isVoxelMesh = !!(pick.pickedMesh && voxelPaletteMeshesRef.current.includes(pick.pickedMesh as BABYLON.Mesh));
          if (normal && isVoxelMesh) {
            point = point.add(normal.scale(voxelSize * 0.5 + 1e-3));
          }
          const axis = axisLock !== 'auto' ? axisLock : chooseAxisFromNormal(normal);
          dragAxisRef.current = axis;
        }
        let gridPoint = worldToGrid(point);
        if (snapToSegments) {
          const axis: 'x' | 'y' | 'z' = axisLock !== 'auto' ? axisLock : dragAxisRef.current;
          if (axis === 'y') {
            const range = getLayerRange(activeLayer, gridPoint.y);
            gridPoint.y = getLayerMid(range);
          }
        }
        dragStartRef.current = gridPoint;
        isDraggingRef.current = true;
        dragStartSnapshotRef.current = voxelsRef.current;
        if (brush === 'point') {
          if (tool === 'add' || tool === 'paint') setVoxel(gridPoint.x, gridPoint.y, gridPoint.z, selectedColorIndex);
          else if (tool === 'remove') removeVoxel(gridPoint.x, gridPoint.y, gridPoint.z);
        }
      }
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
        isDraggingRef.current = false;
        dragStartRef.current = null;
        const snapshot = dragStartSnapshotRef.current;
        dragStartSnapshotRef.current = null;
        if (snapshot) {
          setUndoStack((prev) => {
            const next = [...prev, snapshot];
            return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
          });
          setRedoStack([]);
        }
      }
    });
    pointerObserverRef.current = observer;
    return () => {
      try {
        scene.onPointerObservable.remove(observer);
      } catch {}
    };
  }, [
    mode,
    tool,
    selectedColorIndex,
    voxelSize,
    mirrorX,
    brush,
    axisLock,
    brushRadius,
    activeLayer,
    snapToSegments,
    applyVoxelBatch,
    chooseAxisFromNormal,
    getLayerMid,
    getLayerRange,
    gridToWorld,
    linePositionsAxisAligned,
    rectPositionsOnPlane,
    removeVoxel,
    setVoxel,
    spherePositions,
    worldToGrid,
  ]);
  useEffect(() => {
    try {
      localStorage.setItem('skin-voxels', JSON.stringify(voxels));
    } catch {}
  }, [voxels]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      rootRef.current?.dispose();
    } catch {}
    const instance = createSkinMesh(scene, skinId as any, colorsMemo, undefined);
    rootRef.current = instance.root;
    rootRef.current.rotationQuaternion = null;
    rootRef.current.rotation.y = 0;

    if (beforeRenderObserverRef.current) {
      try {
        scene.onBeforeRenderObservable.remove(beforeRenderObserverRef.current);
      } catch {}
      beforeRenderObserverRef.current = null;
    }

    beforeRenderObserverRef.current = scene.onBeforeRenderObservable.add(() => {
      if (!rootRef.current) return;
      rootRef.current.rotation.y += scene.getEngine().getDeltaTime() * rotationSpeed;
      rootRef.current.scaling.setAll(scale);
      try {
        if (holoRootRef.current) {
          holoRootRef.current.rotation.y += scene.getEngine().getDeltaTime() * 0.00015;
        }
      } catch {}
      try {
        scanPhaseRef.current = (scanPhaseRef.current || 0) + scene.getEngine().getDeltaTime() * 0.0012;
        const ring = scanRingRef.current;
        if (ring) {
          const r = 4.8 + Math.sin(scanPhaseRef.current * Math.PI * 2) * 0.3;
          ring.scaling.setAll(1);
          ring.scaling.x = r / 5.2;
          ring.scaling.y = r / 5.2;
          ring.position.y = Math.sin(scanPhaseRef.current) * 2 + 1;
        }
      } catch {}
      if (mode === 'edit' && !showBaseModel) rootRef.current.setEnabled(false);
      else rootRef.current.setEnabled(true);
    });

    try {
      const camera = scene.activeCamera as BABYLON.ArcRotateCamera | null;
      if (camera && instance) {
        camera.setTarget(new BABYLON.Vector3(0, Math.max(0.8, instance.height * 0.55), 0));
        camera.radius = Math.max(2.5, instance.height * 1.6);
        camera.beta = Math.min(Math.max(Math.PI / 4, camera.beta || Math.PI / 3), Math.PI * 0.9);
        camera.alpha = camera.alpha || Math.PI / 4;
      }
    } catch {}

    try {
      const generator = shadowGenRef.current;
      if (generator && rootRef.current) {
        const map = generator.getShadowMap();
        if (map && map.renderList) map.renderList.length = 0;
        generator.addShadowCaster(rootRef.current, true);
      }
      if (groundRef.current) (groundRef.current as any).receiveShadows = true;
    } catch {}
  }, [skinId, colorsMemo, rotationSpeed, scale, mode, showBaseModel]);
  const getRLEPayload = useCallback(
    () => createRLEPayload(voxelSize, voxelBounds, palette, voxels),
    [voxelSize, voxelBounds, palette, voxels],
  );

  const exportRLE = useCallback(() => {
    const payload = getRLEPayload();
    try {
      navigator.clipboard.writeText(JSON.stringify(payload));
      toast({ title: 'Wyeksportowano (RLE)', description: 'Skopiowano JSON do schowka.' });
    } catch {}
  }, [getRLEPayload, toast]);

  const importRLE = useCallback(() => {
    const data = prompt('Wklej RLE JSON:');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      const rle = parsed?.voxelsRLE && parsed?.bounds ? parsed : parsed?.rle;
      if (!rle || !Array.isArray(rle.voxelsRLE) || !rle.bounds) throw new Error('Brak voxelsRLE');
      const result = decodeVoxelsRLE(rle.voxelsRLE, rle.bounds);
      setVoxels(result as Record<VoxelKey, VoxelColor>);
      if (Array.isArray(rle.palette)) setPalette(rle.palette);
      toast({ title: 'Zaimportowano (RLE)', description: 'Voxele zaladowane.' });
    } catch (error: any) {
      toast({
        title: 'Import error',
        description: error?.message || 'Invalid format',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleSaveRLEToAccount = useCallback(async () => {
    try {
      if (!authUser) {
        toast({
          title: 'Login required',
          description: 'Zaloguj sie, aby zapisac do konta',
          variant: 'destructive',
        });
        return;
      }
      const payload = getRLEPayload();
      const mergedConfig = { ...(storeConfig || {}), voxels: payload } as any;
      await authUpdateProfile({ skinConfig: mergedConfig } as any);
      toast({ title: 'Zapisano do konta', description: 'RLE zapisane w profilu.' });
    } catch (error: any) {
      toast({
        title: 'Blad zapisu',
        description: error?.message || 'Failed to save',
        variant: 'destructive',
      });
    }
  }, [authUser, toast, getRLEPayload, storeConfig, authUpdateProfile]);

  const handleLoadRLEFromAccount = useCallback(async () => {
    try {
      if (!authUser) {
        toast({
          title: 'Login required',
          description: 'Zaloguj sie, aby wczytac z konta',
          variant: 'destructive',
        });
        return;
      }
      const response = await AuthService.getMe();
      const config = (response?.user as any)?.skinConfig;
      let parsed = config;
      if (typeof config === 'string') {
        try {
          parsed = JSON.parse(config);
        } catch {}
      }
      const payload = parsed?.voxels;
      if (payload && Array.isArray(payload.voxelsRLE)) {
        const result = decodeVoxelsRLE(payload.voxelsRLE, payload.bounds);
        setVoxels(result as Record<VoxelKey, VoxelColor>);
        if (Array.isArray(payload.palette)) setPalette(payload.palette);
        toast({ title: 'Zaladowano z konta', description: 'RLE wczytane z profilu.' });
      } else {
        toast({
          title: 'Brak danych RLE',
          description: 'No voxelsRLE found in profile',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Blad wczytywania',
        description: error?.message || 'Failed to load',
        variant: 'destructive',
      });
    }
  }, [authUser, toast]);

  const savePresets = useCallback(
    (next: SkinPreset[]) => {
      setPresets(next);
      try {
        localStorage.setItem('skin-presets', JSON.stringify(next));
      } catch {}
    },
    [],
  );

  const handlePresetSave = useCallback(() => {
    const name = prompt('Preset name:', 'Mój skin');
    if (!name) return;
    const preset: SkinPreset = {
      id: Date.now().toString(36),
      name,
      skinId,
      primary: primaryHex,
      secondary: secondaryHex,
    };
    savePresets([preset, ...presets]);
    setSelectedPresetId(preset.id);
  }, [primaryHex, secondaryHex, skinId, presets, savePresets]);

  const handlePresetLoad = useCallback(
    (id: string) => {
      const preset = presets.find((item) => item.id === id);
      if (!preset) return;
      setSelectedPresetId(id);
      setLocalSkinId(preset.skinId);
      setPrimaryHex(preset.primary);
      setSecondaryHex(preset.secondary);
    },
    [presets],
  );

  const handlePresetDelete = useCallback(
    (id: string) => {
      const remaining = presets.filter((item) => item.id !== id);
      savePresets(remaining);
      if (selectedPresetId === id) setSelectedPresetId('');
    },
    [presets, savePresets, selectedPresetId],
  );

  const handleExportVoxels = useCallback(() => {
    try {
      navigator.clipboard.writeText(JSON.stringify({ voxels, voxelSize }));
      toast({ title: 'Wyeksportowano', description: 'Dane voxel skopiowane do schowka.' });
    } catch {}
  }, [voxels, voxelSize, toast]);

  const handleImportVoxels = useCallback(() => {
    const data = prompt('Wklej dane voxeli (JSON):');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.voxels) setVoxels(parsed.voxels);
      toast({ title: 'Zaimportowano', description: 'Voxele zaladowane.' });
    } catch {
      toast({ title: 'Import error', description: 'Invalid format', variant: 'destructive' });
    }
  }, [toast]);
  const handleSave = useCallback(async () => {
    const primary = fromHex(primaryHex, storeColors.primary);
    const secondary = fromHex(secondaryHex, storeColors.secondary);
    setSkinId(skinId);
    setColors({ primary, secondary });
    try {
      if (authUser) {
        await authUpdateProfile({
          skinId: skinId,
          skinPrimary: primary,
          skinSecondary: secondary,
        } as any);
      }
      toast({
        title: 'Zapisano',
        description: authUser ? 'Skin saved to account.' : 'Skin saved locally.',
      });
    } catch (error: any) {
      toast({
        title: 'Blad zapisu',
        description: error?.message || 'Failed to save',
        variant: 'destructive',
      });
    }
  }, [primaryHex, secondaryHex, storeColors.primary, storeColors.secondary, setSkinId, setColors, skinId, authUser, authUpdateProfile, toast]);

  const handleReset = useCallback(() => {
    const defaults = DEFAULT_COLORS_BY_SKIN[skinId] || DEFAULT_COLORS_BY_SKIN.boy;
    setPrimaryHex(defaults.primary);
    setSecondaryHex(defaults.secondary);
    setHeadType('cube');
    setBodyType('normal');
    setLimbStyle('block');
    setHat('none');
    setBack('none');
    setEyes('dot');
    setMouth('smile');
    setVoxels({});
  }, [skinId]);

  const handleRandomize = useCallback(() => {
    const random = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
    setPrimaryHex(random());
    setSecondaryHex(random());
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((redo) => [...redo, voxelsRef.current]);
      setVoxels(last);
      return prev.slice(0, prev.length - 1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((undo) => [...undo, voxelsRef.current]);
      setVoxels(last);
      return prev.slice(0, prev.length - 1);
    });
  }, []);

  const clearVoxels = useCallback(() => {
    setVoxels({});
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const createSkinPayload = useCallback(() => ({
    ...getRLEPayload(),
    skinId,
    colors: { primary: primaryHex, secondary: secondaryHex },
    meta: {
      skinId,
      colors: { primary: primaryHex, secondary: secondaryHex },
      config: kogamaConfig,
    },
  }), [getRLEPayload, skinId, primaryHex, secondaryHex, kogamaConfig]);

  const handleCreateSkinEntry = useCallback(
    async (name: string, publish: boolean) => {
      if (!authUser) {
        toast({
          title: 'Login required',
          description: 'Zaloguj sie, aby zapisywac skiny.',
          variant: 'destructive',
        });
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        toast({ title: 'Brak nazwy', description: 'Podaj nazwe skina.', variant: 'destructive' });
        return;
      }
      const payload = createSkinPayload();
      await runWithBusy('skin-create', async () => {
        const thumbnail = await captureThumbnail();
        await SkinsService.createSkin({
          name: trimmed,
          data: JSON.stringify(payload),
          thumbnail,
          published: publish,
        });
        toast({
          title: publish ? 'Skin opublikowany' : 'Skin zapisany',
          description: publish ? 'Skin opublikowano w bibliotece.' : 'Skin zapisano jako szkic.',
        });
        setNewSkinName('');
        await refreshMySkins();
      });
    },
    [authUser, toast, createSkinPayload, runWithBusy, captureThumbnail, refreshMySkins],
  );

  const handleTogglePublishState = useCallback(
    async (skin: SkinWithListings, publish: boolean) => {
      await runWithBusy(`skin-publish-${skin.id}`, async () => {
        await SkinsService.updateSkin(skin.id, { published: publish });
        toast({
          title: publish ? 'Opublikowano' : 'Ukryto skin',
          description: publish ? 'Skin jest teraz publiczny.' : 'Skin zostal oznaczony jako szkic.',
        });
        await refreshMySkins();
      });
    },
    [refreshMySkins, runWithBusy, toast],
  );

  const handleDeleteSkinEntry = useCallback(
    async (skin: SkinWithListings) => {
      const confirmed = confirm(`Usunac skin \"${skin.name}\"?`);
      if (!confirmed) return;
      await runWithBusy(`skin-delete-${skin.id}`, async () => {
        await SkinsService.deleteSkin(skin.id);
        toast({ title: 'Usunieto skin', description: 'Skin zostal usuniety.' });
        await refreshMySkins();
      });
    },
    [refreshMySkins, runWithBusy, toast],
  );

  const handleCreateListingForSkin = useCallback(
    async (skin: SkinWithListings, priceInput: string) => {
      const price = parsePriceInput(priceInput);
      if (price === null) {
        toast({ title: 'Invalid price', description: 'Provide a valid price.', variant: 'destructive' });
        return;
      }
      await runWithBusy(`listing-create-${skin.id}`, async () => {
        await SkinsService.createListing(skin.id, { price });
        toast({ title: 'Wystawiono skin', description: `Cena: ${formatPrice(price)}` });
        await refreshMySkins();
      });
    },
    [refreshMySkins, runWithBusy, toast],
  );

  const handleUpdateListingPrice = useCallback(
    async (skin: SkinWithListings, listingId: string, priceInput: string) => {
      const price = parsePriceInput(priceInput);
      if (price === null) {
        toast({ title: 'Invalid price', description: 'Provide a valid price.', variant: 'destructive' });
        return;
      }
      await runWithBusy(`listing-update-${listingId}`, async () => {
        await SkinsService.updateListing(skin.id, listingId, { price });
        toast({ title: 'Zaktualizowano oferte', description: `Cena: ${formatPrice(price)}` });
        await refreshMySkins();
      });
    },
    [refreshMySkins, runWithBusy, toast],
  );

  const handleCancelListingAction = useCallback(
    async (skin: SkinWithListings, listingId: string) => {
      await runWithBusy(`listing-cancel-${listingId}`, async () => {
        await SkinsService.cancelListing(skin.id, listingId);
        toast({ title: 'Listing cancelled', description: 'Listing was removed.' });
        await refreshMySkins();
      });
    },
    [refreshMySkins, runWithBusy, toast],
  );

  const handlePreviewListing = useCallback(
    (listing: SkinListingWithSkin) => {
      const meta = loadSkinFromPayload(listing.skin.data);
      if (meta?.skinId) setLocalSkinId(meta.skinId);
      if (meta?.colors?.primary) setPrimaryHex(meta.colors.primary);
      if (meta?.colors?.secondary) setSecondaryHex(meta.colors.secondary);
      setActiveTab('editor');
      toast({ title: 'Podglad skinu', description: 'Zaladowano skin z oferty.' });
    },
    [loadSkinFromPayload, toast],
  );

  const handlePurchaseListing = useCallback(
    async (listing: SkinListingWithSkin) => {
      await runWithBusy(`listing-purchase-${listing.id}`, async () => {
        await SkinsService.purchaseListing(listing.skinId, listing.id);
        toast({ title: 'Zakupiono skin', description: 'Skin zostal dodany do biblioteki.' });
        await Promise.all([refreshMarketplace(), refreshMySkins()]);
      });
    },
    [refreshMarketplace, refreshMySkins, runWithBusy, toast],
  );
  const filteredMySkins = useMemo(() => {
    const search = mySkinsSearch.trim().toLowerCase();
    return mySkins
      .filter((skin) => {
        if (mySkinsFilter === 'draft' && skin.published) return false;
        if (mySkinsFilter === 'published' && !skin.published) return false;
        if (!search) return true;
        return (
          skin.name.toLowerCase().includes(search) ||
          skin.id.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [mySkins, mySkinsFilter, mySkinsSearch]);

  const filteredMarketplace = useMemo(() => {
    const search = marketplaceSearch.trim().toLowerCase();
    const filtered = marketplaceListings.filter((listing) => {
      if (marketplaceFilter === 'available' && (!listing.active || listing.buyerId)) return false;
      if (marketplaceFilter === 'owned' && listing.skin.ownerId !== authUser?.id) return false;
      if (!search) return true;
      return (
        listing.skin.name.toLowerCase().includes(search) ||
        listing.skin.id.toLowerCase().includes(search)
      );
    });
    const sorted = filtered.slice();
    if (marketplaceSort === 'recent') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (marketplaceSort === 'price-asc') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (marketplaceSort === 'price-desc') {
      sorted.sort((a, b) => b.price - a.price);
    }
    return sorted;
  }, [marketplaceListings, marketplaceFilter, marketplaceSearch, marketplaceSort, authUser?.id]);

  const appearanceState = useMemo(() => ({
    skinId,
    setSkinId: setLocalSkinId,
    primaryHex,
    setPrimaryHex,
    secondaryHex,
    setSecondaryHex,
    scale,
    setScale,
    rotationSpeed,
    setRotationSpeed,
    save: handleSave,
    reset: handleReset,
    randomize: handleRandomize,
  }), [skinId, primaryHex, secondaryHex, scale, rotationSpeed, handleSave, handleReset, handleRandomize]);

  const presetsState = useMemo(() => ({
    presets,
    selectedPresetId,
    savePreset: handlePresetSave,
    loadPreset: handlePresetLoad,
    deletePreset: handlePresetDelete,
  }), [presets, selectedPresetId, handlePresetSave, handlePresetLoad, handlePresetDelete]);

  const undoRedoState = useMemo(() => ({
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undo: handleUndo,
    redo: handleRedo,
  }), [undoStack.length, redoStack.length, handleUndo, handleRedo]);

  const setPaletteColor: PaletteUpdater = useCallback((index, color) => {
    setPalette((prev) => {
      const next = prev.slice();
      next[index] = color;
      return next;
    });
  }, []);

  const voxelsState = useMemo(() => ({
    tool,
    setTool,
    brush,
    setBrush,
    axisLock,
    setAxisLock,
    activeLayer,
    setActiveLayer,
    selectedColorIndex,
    setSelectedColorIndex,
    palette,
    setPaletteColor,
    brushRadius,
    setBrushRadius,
    showGrid,
    setShowGrid,
    snapToSegments,
    setSnapToSegments,
    mirrorX,
    setMirrorX,
    clear: clearVoxels,
    exportVoxels: handleExportVoxels,
    importVoxels: handleImportVoxels,
    exportRLE,
    importRLE,
    saveRLEToAccount: handleSaveRLEToAccount,
    loadRLEFromAccount: handleLoadRLEFromAccount,
    undoRedo: undoRedoState,
  }), [
    tool,
    brush,
    axisLock,
    activeLayer,
    selectedColorIndex,
    palette,
    setPaletteColor,
    brushRadius,
    showGrid,
    snapToSegments,
    mirrorX,
    clearVoxels,
    handleExportVoxels,
    handleImportVoxels,
    exportRLE,
    importRLE,
    handleSaveRLEToAccount,
    handleLoadRLEFromAccount,
    undoRedoState,
  ]);

  const editorState = useMemo(() => ({
    mode,
    setMode,
    showBaseModel,
    setShowBaseModel,
    quality,
    setQuality,
    appearance: appearanceState,
    voxels: voxelsState,
    presets: presetsState,
  }), [mode, setMode, showBaseModel, setShowBaseModel, quality, setQuality, appearanceState, voxelsState, presetsState]);

  const libraryState = useMemo(() => ({
    isAuthenticated: !!authUser,
    newSkinName,
    setNewSkinName,
    filter: mySkinsFilter,
    setFilter: setMySkinsFilter,
    search: mySkinsSearch,
    setSearch: setMySkinsSearch,
    loading: mySkinsLoading,
    refresh: refreshMySkins,
    items: mySkins,
    filteredItems: filteredMySkins,
    actions: {
      create: handleCreateSkinEntry,
      load: handleLoadSkinRecord,
      apply: handleApplySkinFromEditor,
      togglePublish: handleTogglePublishState,
      remove: handleDeleteSkinEntry,
      createListing: handleCreateListingForSkin,
      updateListing: handleUpdateListingPrice,
      cancelListing: handleCancelListingAction,
    },
  }), [
    authUser,
    newSkinName,
    setNewSkinName,
    mySkinsFilter,
    setMySkinsFilter,
    mySkinsSearch,
    setMySkinsSearch,
    mySkinsLoading,
    refreshMySkins,
    mySkins,
    filteredMySkins,
    handleCreateSkinEntry,
    handleLoadSkinRecord,
    handleApplySkinFromEditor,
    handleTogglePublishState,
    handleDeleteSkinEntry,
    handleCreateListingForSkin,
    handleUpdateListingPrice,
    handleCancelListingAction,
  ]);

  const marketplaceState = useMemo(() => ({
    filter: marketplaceFilter,
    setFilter: setMarketplaceFilter,
    search: marketplaceSearch,
    setSearch: setMarketplaceSearch,
    sort: marketplaceSort,
    setSort: setMarketplaceSort,
    listings: marketplaceListings,
    filteredListings: filteredMarketplace,
    loading: marketplaceLoading,
    refresh: refreshMarketplace,
    actions: {
      preview: handlePreviewListing,
      purchase: handlePurchaseListing,
    },
  }), [
    marketplaceFilter,
    setMarketplaceFilter,
    marketplaceSearch,
    setMarketplaceSearch,
    marketplaceSort,
    setMarketplaceSort,
    marketplaceListings,
    filteredMarketplace,
    marketplaceLoading,
    refreshMarketplace,
    handlePreviewListing,
    handlePurchaseListing,
  ]);

  return {
    canvasRef,
    layout: { activeTab, setActiveTab },
    editor: editorState,
    library: libraryState,
    marketplace: marketplaceState,
    currentUser: authUser as UserProfile | null,
    isActionBusy,
  };
};




