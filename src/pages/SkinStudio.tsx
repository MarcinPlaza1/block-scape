import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { ActiveLayer, VoxelKey, VoxelColor, makeKey, parseKey, createClampToBounds, createWorldToGrid as createWorldToGridUtil, chooseAxisFromNormal as chooseAxisFromNormalUtil, rectPositionsOnPlane as rectPositionsOnPlaneUtil, linePositionsAxisAligned as linePositionsAxisAlignedUtil, spherePositions as spherePositionsUtil, applyVoxelBatchGeneric } from '@/pages/skin-studio/lib/voxel-utils';
import { createRLEPayload, decodeVoxelsRLE } from '@/pages/skin-studio/lib/rle';
import { applyQualitySettings } from '@/pages/skin-studio/lib/quality';
import { setupSkinStudioCamera, enhanceCameraControls } from '@/pages/skin-studio/lib/camera';
import { createSkinMesh, type PlayerSkinColors } from '@/components/editor-enhanced/scene/systems/play/skins/registry';
import type { PlayerSkinId } from '@/features/player/store';
import PageTransition from '@/components/ui/PageTransition';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlayerSettingsStore } from '@/features/player/store';
import { useAuthStore } from '@/features/auth/store';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/services/api.service';
import { SkinsService } from '@/services/api.service';
import { Loader2 } from 'lucide-react';
import { formatPrice, type SkinListingWithSkin, type SkinVisibilityFilter, type SkinWithListings } from '@/types/skins';

const toHex = (n: number) => `#${(n >>> 0 & 0xffffff).toString(16).padStart(6, '0')}`;
const fromHex = (s: string, fallback: number) => {
	try {
		const t = s.trim();
		const hex = t.startsWith('#') ? t.slice(1) : t.startsWith('0x') ? t.slice(2) : t;
		const v = parseInt(hex, 16);
		return Number.isFinite(v) ? (v >>> 0) & 0xffffff : fallback;
	} catch { return fallback; }
};

type SkinPreset = { id: string; name: string; skinId: PlayerSkinId; primary: string; secondary: string };

type EditorMode = 'preview' | 'edit';
type EditorTool = 'add' | 'remove' | 'paint';
type EditorBrush = 'point' | 'line' | 'rect' | 'sphere';
type AxisLock = 'auto' | 'x' | 'y' | 'z';

// Voxel helpers moved to '@/pages/skin-studio/lib/voxel-utils'

const UNDO_LIMIT = 50;

const SkinStudio = () => {
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

	// Voxel editor refs
	const voxelRootRef = useRef<BABYLON.TransformNode | null>(null);
	const voxelPrimaryRef = useRef<BABYLON.Mesh | null>(null);
	const voxelSecondaryRef = useRef<BABYLON.Mesh | null>(null);
	const ghostRef = useRef<BABYLON.Mesh | null>(null);
	const pointerObserverRef = useRef<BABYLON.Observer<BABYLON.PointerInfo> | null>(null);
	const isDraggingRef = useRef<boolean>(false);
	const dragStartRef = useRef<{ x: number; y: number; z: number } | null>(null);
	const dragAxisRef = useRef<'x'|'y'|'z'>('y');
	const gridRootRef = useRef<BABYLON.TransformNode | null>(null);
	const voxelsRef = useRef<Record<VoxelKey, VoxelColor>>({});
	const dragStartSnapshotRef = useRef<Record<VoxelKey, VoxelColor> | null>(null);
	// removed unused grid segment/highlight refs
	const voxelPaletteMeshesRef = useRef<BABYLON.Mesh[]>([]);

	const storeSkinId = usePlayerSettingsStore(s => s.skinId);
	const storeColors = usePlayerSettingsStore(s => s.colors);
	const setSkinId = usePlayerSettingsStore(s => s.setSkinId);
	const setColors = usePlayerSettingsStore(s => s.setColors);
	const storeConfig = usePlayerSettingsStore(s => (s as any).config);
	const setConfig = usePlayerSettingsStore(s => (s as any).setConfig);
	const authUser = useAuthStore(s => s.user);
	const authUpdateProfile = useAuthStore(s => s.updateProfile);
	const { toast } = useToast();

	const [skinId, setLocalSkinId] = useState<PlayerSkinId>(storeSkinId);
	const [primaryHex, setPrimaryHex] = useState<string>(() => toHex(storeColors.primary));
	const [secondaryHex, setSecondaryHex] = useState<string>(() => toHex(storeColors.secondary));
	const [rotationSpeed, setRotationSpeed] = useState<number>(0.001);
	const [scale, setScale] = useState<number>(1);
	const [quality, setQuality] = useState<'low'|'medium'|'high'>('high');
	const [headType, setHeadType] = useState<'cube'|'rounded'|'capsule'>(storeConfig?.headType || 'cube');
	const [bodyType, setBodyType] = useState<'slim'|'normal'|'bulk'>(storeConfig?.bodyType || 'normal');
	const [limbStyle, setLimbStyle] = useState<'block'|'cylinder'>(storeConfig?.limbStyle || 'block');
	const [hat, setHat] = useState<'none'|'cap'|'topHat'>(storeConfig?.accessoryHat || 'none');
	const [back, setBack] = useState<'none'|'backpack'|'cape'>(storeConfig?.accessoryBack || 'none');
	const [eyes, setEyes] = useState<'dot'|'cartoon'|'robot'>(storeConfig?.face?.eyes || 'dot');
	const [mouth, setMouth] = useState<'smile'|'neutral'|'none'>(storeConfig?.face?.mouth || 'smile');
	const [presets, setPresets] = useState<SkinPreset[]>(() => {
		try {
			const raw = localStorage.getItem('skin-presets');
			return raw ? JSON.parse(raw) : [];
		} catch { return []; }
	});
	const [selectedPresetId, setSelectedPresetId] = useState<string>('');

	const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'marketplace'>('editor');
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
	const [marketplaceSort, setMarketplaceSort] = useState<'recent' | 'price-asc' | 'price-desc'>('recent');
	const [marketplaceFilter, setMarketplaceFilter] = useState<'available' | 'all' | 'owned'>('available');
	const [busyActions, setBusyActions] = useState<Record<string, boolean>>({});

	// Default color presets per skin
	const DEFAULT_COLORS_BY_SKIN: Record<PlayerSkinId, { primary: string; secondary: string }> = {
		boy: { primary: '#3B82F6', secondary: '#60A5FA' },
		girl: { primary: '#E11D48', secondary: '#F472B6' },
	};

	// Modes and voxel editor state
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
			// migrate from legacy 'primary'/'secondary'
			for (const k in parsed) {
				if (parsed[k] === 'primary') parsed[k] = 0;
				else if (parsed[k] === 'secondary') parsed[k] = 1;
			}
			return parsed;
		} catch { return {}; }
	});
	const [undoStack, setUndoStack] = useState<Record<VoxelKey, VoxelColor>[]>([]);
	const [redoStack, setRedoStack] = useState<Record<VoxelKey, VoxelColor>[]>([]);

		const setActionBusy = useCallback((key: string, busy: boolean) => {
		setBusyActions(prev => {
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

	const runWithBusy = useCallback(async (key: string, fn: () => Promise<void>) => {
		setActionBusy(key, true);
		try {
			await fn();
		} finally {
			setActionBusy(key, false);
		}
	}, [setActionBusy]);

	const captureThumbnail = useCallback(async (): Promise<string | undefined> => {
		if (typeof window === 'undefined') return undefined;
		const canvas = canvasRef.current;
		const scene = sceneRef.current;
		if (!canvas) return undefined;
		try { scene?.render(); } catch {}
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
			try { return canvas.toDataURL('image/png'); } catch { return undefined; }
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
			const res = await SkinsService.getMySkins();
			setMySkins(res.skins || []);
		} catch (error: any) {
			toast({ title: 'Nie udalo sie pobrac skin�w', description: error?.message || 'Spr�buj ponownie p�zniej.', variant: 'destructive' });
		} finally {
			setMySkinsLoading(false);
			setMySkinsFetched(true);
		}
	}, [authUser, toast]);

	const refreshMarketplace = useCallback(async () => {
		setMarketplaceLoading(true);
		try {
			const res = await SkinsService.getListings();
			setMarketplaceListings(res.listings || []);
		} catch (error: any) {
			toast({ title: 'Nie udalo sie pobrac marketplace', description: error?.message || 'Spr�buj ponownie p�zniej.', variant: 'destructive' });
		} finally {
			setMarketplaceLoading(false);
			setMarketplaceFetched(true);
		}
	}, [toast]);

	const parsePriceInput = (value: string): number | null => {
		const normalized = value.replace(',', '.').trim();
		if (!normalized) return null;
		const amount = Number(normalized);
		if (!Number.isFinite(amount) || amount <= 0) return null;
		return Math.round(amount * 100);
	};

	const loadSkinFromPayload = useCallback((payloadString: string) => {
		try {
			const payload = JSON.parse(payloadString);
			if (!payload || !Array.isArray(payload.voxelsRLE) || !payload.bounds) throw new Error('Brak voxeli');
			const decoded = decodeVoxelsRLE(payload.voxelsRLE, payload.bounds);
			setVoxels(decoded as Record<VoxelKey, VoxelColor>);
			if (Array.isArray(payload.palette)) setPalette(payload.palette);
			toast({ title: 'Wczytano skina', description: 'Dane skina zaladowane do edytora.' });
		} catch (error: any) {
			toast({ title: 'Nie udalo sie wczytac skina', description: error?.message || 'Niepoprawny format danych.', variant: 'destructive' });
		}
	}, [toast]);

	const handleLoadSkinRecord = useCallback((skinData: { data: string }) => {
		loadSkinFromPayload(skinData.data);
	}, [loadSkinFromPayload]);

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

	useEffect(() => { voxelsRef.current = voxels; }, [voxels]);

	// 16-color palette (slot 0 maps to Primary, 1 to Secondary)
	const [palette, setPalette] = useState<string[]>(() => {
		const p0 = toHex(storeColors.primary);
		const p1 = toHex(storeColors.secondary);
		return [p0, p1, '#FFD166', '#EF476F', '#06D6A0', '#118AB2', '#073B4C', '#A78BFA', '#F59E0B', '#10B981', '#3B82F6', '#F97316', '#E11D48', '#14B8A6', '#22C55E', '#8B5CF6'];
	});
	// keep slots 0/1 synced with Primary/Secondary inputs
	useEffect(() => {
		setPalette(prev => { const n = prev.slice(); n[0] = primaryHex; return n; });
	}, [primaryHex]);
	useEffect(() => {
		setPalette(prev => { const n = prev.slice(); n[1] = secondaryHex; return n; });
	}, [secondaryHex]);

	const colorsMemo: PlayerSkinColors = useMemo(() => ({
		primary: BABYLON.Color3.FromHexString(primaryHex),
		secondary: BABYLON.Color3.FromHexString(secondaryHex),
	}), [primaryHex, secondaryHex]);

	const kogamaConfig = useMemo(() => ({
		headType,
		bodyType,
		limbStyle,
		accessoryHat: hat,
		accessoryBack: back,
		face: { eyes, mouth },
	}), [headType, bodyType, limbStyle, hat, back, eyes, mouth]);

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
		// Transparent clear to let gradient show through if needed
		try { (scene as any).clearColor = new (BABYLON as any).Color4(0, 0, 0, 0); } catch {}

		const camera = setupSkinStudioCamera(scene, canvasRef.current);
		try { scene.activeCamera = camera; } catch {}
		enhanceCameraControls(camera, scene, canvasRef.current);

		const hemi = new BABYLON.HemisphericLight('h1', new BABYLON.Vector3(1, 1, 0), scene);
		hemi.intensity = 0.6;
		const d = new BABYLON.DirectionalLight('d1', new BABYLON.Vector3(-1, -2, -1), scene);
		d.position = new BABYLON.Vector3(4, 6, 4);
		d.intensity = 0.9;
		dirLightRef.current = d;
		try { d.shadowMinZ = 1; d.shadowMaxZ = 20; } catch {}

		const ground = BABYLON.MeshBuilder.CreateGround('g', { width: 16, height: 16 }, scene);
		const gmat = new BABYLON.PBRMaterial('gmat', scene);
		gmat.metallic = 0.0;
		gmat.roughness = 1.0;
		gmat.albedoColor = new BABYLON.Color3(0.12, 0.12, 0.12);
		ground.material = gmat;
		(ground as any).receiveShadows = true;
		groundRef.current = ground as BABYLON.Mesh;
		ground.position.y = 0;

		try {
			const sg = new BABYLON.ShadowGenerator(1024, d);
			const sm = sg.getShadowMap();
			if (sm) sm.refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
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

			// Holographic blue environment (Tony Stark style)
 			try {
 				const holoRoot = new BABYLON.TransformNode('holo_root', scene);
 				holoRootRef.current = holoRoot;
 				// Inside-out sphere as subtle blue dome
 				const dome = BABYLON.MeshBuilder.CreateSphere('holo_dome', { diameter: 40, segments: 48, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
 				dome.parent = holoRoot;
 				const domeMat = new BABYLON.StandardMaterial('holo_dome_mat', scene);
 				domeMat.emissiveColor = new BABYLON.Color3(0.2, 0.6, 1.0);
 				domeMat.alpha = 0.08;
 				dome.material = domeMat;
 				dome.isPickable = false;
 				// Wireframe cube to give "square" hologram vibe
 				const cube = BABYLON.MeshBuilder.CreateBox('holo_cube', { size: 32 }, scene);
 				cube.parent = holoRoot;
 				const cubeMat = new BABYLON.StandardMaterial('holo_cube_mat', scene);
 				cubeMat.emissiveColor = new BABYLON.Color3(0.2, 0.6, 1.0);
 				cubeMat.alpha = 0.12;
 				cubeMat.wireframe = true;
 				cube.material = cubeMat;
 				cube.isPickable = false;
 				// Thin scanning ring (animated scale)
 				const ring = BABYLON.MeshBuilder.CreateTorus('holo_ring', { diameter: 5.2, thickness: 0.01, tessellation: 64 }, scene);
 				ring.parent = holoRoot;
 				ring.rotation.x = Math.PI / 2;
 				const ringMat = new BABYLON.StandardMaterial('holo_ring_mat', scene);
 				ringMat.emissiveColor = new BABYLON.Color3(0.3, 0.8, 1.0);
 				ringMat.alpha = 0.5;
 				ring.material = ringMat;
 				ring.isPickable = false;
 				scanRingRef.current = ring;
 				// Vertical grid lines (4 planes) for scanning feel
 				for (let i=0;i<4;i++) {
 					const plane = BABYLON.MeshBuilder.CreatePlane(`holo_grid_${i}`, { width: 30, height: 30 }, scene);
 					plane.parent = holoRoot;
 					plane.position.y = 0;
 					plane.rotation.y = i * Math.PI/4;
 					const pmat = new BABYLON.StandardMaterial(`holo_grid_mat_${i}`, scene);
 					pmat.wireframe = true;
 					pmat.emissiveColor = new BABYLON.Color3(0.15, 0.5, 1.0);
 					pmat.alpha = 0.04;
 					plane.material = pmat;
 					plane.isPickable = false;
 				}
 				// Soft glow for holographic feel
 				try { const glow = new BABYLON.GlowLayer('holo_glow', scene, { blurKernelSize: 32 }); (glow as any).intensity = 0.35; } catch {}
 			} catch {}

		// Voxel editor setup
		try {
			const voxelRoot = new BABYLON.TransformNode('voxel_root', scene);
			voxelRootRef.current = voxelRoot;
			const mkMat = (name: string, color: BABYLON.Color3) => {
				const m = new BABYLON.PBRMaterial(name, scene);
				m.metallic = 0; m.roughness = 0.8; m.albedoColor = color;
				return m;
			};
			const base = BABYLON.MeshBuilder.CreateBox('voxel_base', { size: 1 }, scene);
			base.isVisible = false; base.isPickable = false; base.parent = voxelRoot;
			const paletteMeshes: BABYLON.Mesh[] = [];
			for (let i=0; i<16; i++) {
				const m = base.clone(`voxel_pal_${i}`) as BABYLON.Mesh;
				m.isVisible = true; m.isPickable = true;
				m.material = mkMat(`voxel_mat_${i}`, BABYLON.Color3.FromHexString((palette && palette[i]) || '#ffffff'));
				paletteMeshes.push(m);
			}
			voxelPaletteMeshesRef.current = paletteMeshes;
			voxelPrimaryRef.current = paletteMeshes[0];
			voxelSecondaryRef.current = paletteMeshes[1];
			// Ghost
			const ghost = BABYLON.MeshBuilder.CreateBox('voxel_ghost', { size: 1 }, scene);
			const ghostMat = new BABYLON.StandardMaterial('voxel_ghost_mat', scene);
			try { ghostMat.diffuseColor = BABYLON.Color3.FromHexString(palette[0]); } catch { ghostMat.diffuseColor = new BABYLON.Color3(1,1,1); }
			ghostMat.alpha = 0.35; ghost.material = ghostMat; ghost.isPickable = false; ghost.setEnabled(false);
			ghostRef.current = ghost;
		} catch {}

		// Grid overlay (segment boxes)
		try {
			const gridRoot = new BABYLON.TransformNode('grid_root', scene);
			gridRootRef.current = gridRoot;
			const mkWireMat = (name: string, color: BABYLON.Color3) => {
				const m = new BABYLON.StandardMaterial(name, scene);
				m.emissiveColor = color;
				m.diffuseColor = color;
				m.specularColor = BABYLON.Color3.Black();
				m.wireframe = true;
				return m;
			};
			const fullW = voxelBounds.x * voxelSize;
			const fullD = voxelBounds.z * voxelSize;
			const addSegmentBox = (id: string, yMin: number, yMax: number, color: BABYLON.Color3) => {
				const h = (yMax - yMin + 1) * voxelSize;
				const box = BABYLON.MeshBuilder.CreateBox(id, { width: fullW, height: h, depth: fullD }, scene);
				box.material = mkWireMat(`${id}_mat`, color);
				box.isPickable = false;
				box.position = new BABYLON.Vector3(0, (yMin + yMax + 1) * 0.5 * voxelSize, 0);
				box.parent = gridRoot;
			};
			addSegmentBox('grid_legs', 0, 7, new BABYLON.Color3(0.2, 0.8, 0.2));
			addSegmentBox('grid_torso', 8, 15, new BABYLON.Color3(0.2, 0.6, 1.0));
			addSegmentBox('grid_head', 16, 23, new BABYLON.Color3(1.0, 0.6, 0.2));
			gridRoot.setEnabled(false);
		} catch {}

		try { engine.stopRenderLoop(); } catch {}
		engine.runRenderLoop(() => {
			try { scene.render(); } catch {}
		});
		// Ensure engine matches canvas size on first frame
		try { engine.resize(); } catch {}

		const onResize = () => engine.resize();
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			try { engine.stopRenderLoop(); } catch {}
			try { scene.dispose(); } catch {}
			try { engine.dispose(); } catch {}
			sceneRef.current = null; engineRef.current = null; rootRef.current = null;
			shadowGenRef.current = null; pipelineRef.current = null; dirLightRef.current = null; groundRef.current = null;
			voxelRootRef.current = null; voxelPrimaryRef.current = null; voxelSecondaryRef.current = null; ghostRef.current = null; gridRootRef.current = null;
		};
	}, []);

	// Toggle grid visibility based on mode and toggle
	useEffect(() => {
		const grid = gridRootRef.current; if (!grid) return;
		try { grid.setEnabled(showGrid && mode === 'edit'); } catch {}
	}, [showGrid, mode]);

	// Highlight active segment
	useEffect(() => {
		const grid = gridRootRef.current; if (!grid) return;
		const children = (grid.getChildren() as BABYLON.AbstractMesh[]) || [];
		children.forEach(ch => {
			try {
				if (!(ch as any).material) return;
				const mat = (ch as any).material as BABYLON.StandardMaterial;
				const id = ch.name || '';
				const isActive = (activeLayer === 'legs' && id.includes('legs')) || (activeLayer === 'torso' && id.includes('torso')) || (activeLayer === 'head' && id.includes('head')) || activeLayer === 'all';
				mat.alpha = isActive ? 0.8 : 0.18;
			} catch {}
		});
	}, [activeLayer]);

	// Quality-based rendering tuning via helper
	useEffect(() => {
		const engine = engineRef.current;
		const scene = sceneRef.current;
		if (!engine || !scene) return;
		applyQualitySettings(engine, scene, shadowGenRef.current, pipelineRef.current, quality);
	}, [quality]);

	// Rebuild thin instances for voxel meshes whenever voxels or colors change
	useEffect(() => {
		const scene = sceneRef.current; if (!scene) return;
		const meshes = voxelPaletteMeshesRef.current;
		if (!meshes || meshes.length === 0) return;
		// Update materials to palette
		meshes.forEach((m, i) => {
			try { ((m.material as any) as BABYLON.PBRMaterial).albedoColor = BABYLON.Color3.FromHexString(palette[i]); } catch {}
			try { m.isVisible = true; } catch {}
		});

		const transformsByPalette: number[][] = Array.from({ length: 16 }, () => []);
		const size = voxelSize;
		const addTransform = (arr: number[], x: number, y: number, z: number) => {
			const m = BABYLON.Matrix.Compose(new BABYLON.Vector3(size, size, size), BABYLON.Quaternion.Identity(), new BABYLON.Vector3(x * size, y * size, z * size));
			m.copyToArray(arr, arr.length);
		};
		Object.entries(voxels).forEach(([k, col]) => {
			const { x, y, z } = parseKey(k);
			let idx: number | null = null;
			if (typeof col === 'number') idx = Math.max(0, Math.min(15, col));
			else if (col === 'primary') idx = 0; else if (col === 'secondary') idx = 1;
			if (idx !== null) addTransform(transformsByPalette[idx], x, y, z);
		});
		for (let i=0; i<meshes.length; i++) {
			try { meshes[i].thinInstanceSetBuffer('matrix', new Float32Array(transformsByPalette[i]), 16, true); } catch {}
		}
	}, [voxels, palette, voxelSize]);

	// Update ghost color when selection changes
	useEffect(() => {
		const ghost = ghostRef.current; if (!ghost) return;
		try { ((ghost.material as any) as BABYLON.StandardMaterial).diffuseColor = BABYLON.Color3.FromHexString(palette[selectedColorIndex]); } catch {}
	}, [selectedColorIndex, palette]);

	// Helper: clamp within bounds
	const clampToBounds = useMemo(() => createClampToBounds(voxelBounds), [voxelBounds]);
	const worldToGrid = useMemo(() => createWorldToGridUtil(voxelSize, voxelBounds), [voxelSize, voxelBounds]);
	const gridToWorld = (x: number, y: number, z: number) => new BABYLON.Vector3(x * voxelSize, y * voxelSize, z * voxelSize);

	const getLayerRange = (layer: ActiveLayer, yHint?: number): { min: number; max: number } => {
		if (layer === 'all') {
			const y = Math.max(0, Math.min(voxelBounds.y - 1, yHint ?? 0));
			if (y <= 7) return { min: 0, max: 7 };
			if (y <= 15) return { min: 8, max: 15 };
			return { min: 16, max: 23 };
		}
		return { legs: { min: 0, max: 7 }, torso: { min: 8, max: 15 }, head: { min: 16, max: 23 } }[layer];
	};
	const getLayerMid = (r: {min:number;max:number}) => Math.floor((r.min + r.max) / 2);

	// Batch operations for performance
	const applyVoxelBatch = (positions: Array<{x:number;y:number;z:number}>, action: 'set'|'remove', color: VoxelColor) => {
		if (positions.length === 0) return;
		setVoxels(prev => applyVoxelBatchGeneric(prev, positions, action, color, { activeLayer, mirrorX, bounds: voxelBounds }));
	};

	// Brush geometry helpers
	const chooseAxisFromNormal = (n: BABYLON.Vector3 | null | undefined): 'x'|'y'|'z' => chooseAxisFromNormalUtil(n as any);

	const rectPositionsOnPlane = (start: {x:number;y:number;z:number}, end: {x:number;y:number;z:number}, planeNormalAxis: 'x'|'y'|'z') => rectPositionsOnPlaneUtil(start, end, planeNormalAxis);

	const linePositionsAxisAligned = (start: {x:number;y:number;z:number}, end: {x:number;y:number;z:number}, axis: 'x'|'y'|'z') => linePositionsAxisAlignedUtil(start, end, axis);

	const spherePositions = (center: {x:number;y:number;z:number}, radius: number) => spherePositionsUtil(center, radius);

	const setVoxel = (x: number, y: number, z: number, color: VoxelColor) => {
		const { x: cx, y: cy, z: cz } = clampToBounds(x, y, z);
		const key = makeKey(cx, cy, cz);
		setVoxels(prev => ({ ...prev, [key]: color }));
		if (mirrorX && cx !== -cx) {
			const mKey = makeKey(-cx, cy, cz);
			setVoxels(prev => ({ ...prev, [key]: color, [mKey]: color }));
		}
	};
	const removeVoxel = (x: number, y: number, z: number) => {
		const { x: cx, y: cy, z: cz } = clampToBounds(x, y, z);
		const key = makeKey(cx, cy, cz);
		setVoxels(prev => { const o = { ...prev }; delete o[key]; if (mirrorX) { delete o[makeKey(-cx, cy, cz)]; } return o; });
	};

	// Pointer interactions in edit mode (drag/extrude/brushes)
	useEffect(() => {
		const scene = sceneRef.current; if (!scene) return;
		if (pointerObserverRef.current) { try { scene.onPointerObservable.remove(pointerObserverRef.current); } catch {} pointerObserverRef.current = null; }
		if (mode !== 'edit') {
			if (ghostRef.current) ghostRef.current.setEnabled(false);
			return;
		}
		const obs = scene.onPointerObservable.add((pi) => {
			if (!scene) return;
			const ghost = ghostRef.current;
			if (pi.type === BABYLON.PointerEventTypes.POINTERMOVE) {
				const pick = scene.pick(scene.pointerX, scene.pointerY);
				if (pick && pick.hit && ghost) {
					let p = pick.pickedPoint?.clone() || new BABYLON.Vector3(0,0,0);
					if (pick.getNormal) {
						const n = pick.getNormal(true);
						const isVoxelMesh = !!(pick.pickedMesh && voxelPaletteMeshesRef.current && voxelPaletteMeshesRef.current.includes(pick.pickedMesh as BABYLON.Mesh));
						if (n && isVoxelMesh) {
							p = p.add(n.scale(voxelSize * 0.5 + 1e-3));
						}
					}
					let g = worldToGrid(p);
					// Segment snapping (align Y to segment mid-plane when applicable)
					if (snapToSegments) {
						const axis: 'x'|'y'|'z' = axisLock !== 'auto' ? axisLock : dragAxisRef.current;
						if (axis === 'y') {
							const range = getLayerRange(activeLayer, g.y);
							g.y = getLayerMid(range);
						}
					}
					ghost.scaling.setAll(voxelSize);
					ghost.position.copyFrom(gridToWorld(g.x, g.y, g.z));
					ghost.setEnabled(true);
					// Drag application while moving
					if (isDraggingRef.current && dragStartRef.current) {
						const start = dragStartRef.current;
						const current = g;
						let positions: Array<{x:number;y:number;z:number}> = [];
						const chosenAxis: 'x'|'y'|'z' = axisLock !== 'auto' ? axisLock : dragAxisRef.current;
						if (brush === 'line') positions = linePositionsAxisAligned(start, current, chosenAxis);
						else if (brush === 'rect') positions = rectPositionsOnPlane(start, current, chosenAxis);
						else if (brush === 'sphere') positions = spherePositions(current, Math.max(1, Math.floor(brushRadius)));
						else positions = [current];
						applyVoxelBatch(positions, tool === 'remove' ? 'remove' : 'set', selectedColorIndex);
					}
				} else if (ghost) {
					ghost.setEnabled(false);
				}
			}
			if (pi.type === BABYLON.PointerEventTypes.POINTERDOWN) {
				if ((pi.event as PointerEvent).button !== 0) return;
				const pick = scene.pick(scene.pointerX, scene.pointerY);
				if (!pick || !pick.hit || !pick.pickedPoint) return;
				let p = pick.pickedPoint.clone();
				if (pick.getNormal) {
					const n = pick.getNormal(true);
					const isVoxelMesh = !!(pick.pickedMesh && voxelPaletteMeshesRef.current && voxelPaletteMeshesRef.current.includes(pick.pickedMesh as BABYLON.Mesh));
					if (n && isVoxelMesh) {
						p = p.add(n.scale(voxelSize * 0.5 + 1e-3));
					}
					const ax = axisLock !== 'auto' ? axisLock : chooseAxisFromNormal(n);
					dragAxisRef.current = ax;
				}
				let g = worldToGrid(p);
				if (snapToSegments) {
					const axis: 'x'|'y'|'z' = axisLock !== 'auto' ? axisLock : dragAxisRef.current;
					if (axis === 'y') {
						const range = getLayerRange(activeLayer, g.y);
						g.y = getLayerMid(range);
					}
				}
				dragStartRef.current = g; isDraggingRef.current = true;
				dragStartSnapshotRef.current = voxelsRef.current;
				if (brush === 'point') {
					if (tool === 'add' || tool === 'paint') setVoxel(g.x, g.y, g.z, selectedColorIndex);
					else if (tool === 'remove') removeVoxel(g.x, g.y, g.z);
				}
			}
			if (pi.type === BABYLON.PointerEventTypes.POINTERUP) {
				isDraggingRef.current = false; dragStartRef.current = null;
				const snap = dragStartSnapshotRef.current; dragStartSnapshotRef.current = null;
				if (snap) {
					setUndoStack(prev => {
						const next = [...prev, snap];
						return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
					});
					setRedoStack([]);
				}
			}
		});
		pointerObserverRef.current = obs;
		return () => { try { scene.onPointerObservable.remove(obs); } catch {}; };
	}, [mode, tool, selectedColorIndex, voxelSize, mirrorX, brush, axisLock, brushRadius, activeLayer, snapToSegments]);

	// Persist voxels locally
	useEffect(() => {
		try { localStorage.setItem('skin-voxels', JSON.stringify(voxels)); } catch {}
	}, [voxels]);

	useEffect(() => {
		if (!sceneRef.current) return;
		try { rootRef.current?.dispose(); } catch {}
		const inst = createSkinMesh(sceneRef.current, (skinId as any), colorsMemo, undefined);
		rootRef.current = inst.root;
		rootRef.current.rotationQuaternion = null;
		rootRef.current.rotation.y = 0;
		// gentle idle rotation + scale
		const scene = sceneRef.current;
		if (scene) {
			if (beforeRenderObserverRef.current) {
				try { scene.onBeforeRenderObservable.remove(beforeRenderObserverRef.current); } catch {}
				beforeRenderObserverRef.current = null;
			}
			beforeRenderObserverRef.current = scene.onBeforeRenderObservable.add(() => {
				if (!rootRef.current) return;
				rootRef.current.rotation.y += scene.getEngine().getDeltaTime() * rotationSpeed;
				rootRef.current.scaling.setAll(scale);
				// Subtle environment motion
				try { if (holoRootRef.current) { holoRootRef.current.rotation.y += scene.getEngine().getDeltaTime() * 0.00015; } } catch {}
				// Animated scanning ring (pulse + vertical sweep)
				try {
					scanPhaseRef.current = (scanPhaseRef.current || 0) + scene.getEngine().getDeltaTime() * 0.0012;
					const ring = scanRingRef.current;
					if (ring) {
						const r = 4.8 + Math.sin(scanPhaseRef.current * Math.PI * 2) * 0.3;
						ring.scaling.setAll(1);
						ring.scaling.x = r / 5.2;
						ring.scaling.y = r / 5.2;
						// sweep height
						ring.position.y = Math.sin(scanPhaseRef.current) * 2.0 + 1.0;
					}
				} catch {}
				// Toggle visibility based on mode
				if (mode === 'edit' && !showBaseModel) {
					rootRef.current.setEnabled(false);
				} else {
					rootRef.current.setEnabled(true);
				}
			});
		}

		// Frame camera to avatar size
		try {
			const cam = scene?.activeCamera as BABYLON.ArcRotateCamera | null;
			if (cam && inst) {
				cam.setTarget(new BABYLON.Vector3(0, Math.max(0.8, inst.height * 0.55), 0));
				cam.radius = Math.max(2.5, inst.height * 1.6);
				cam.beta = Math.min(Math.max(Math.PI / 4, cam.beta || (Math.PI / 3)), Math.PI * 0.9);
				cam.alpha = cam.alpha || (Math.PI / 4);
			}
		} catch {}

		// Update shadow casters and receivers
		try {
			const sg = shadowGenRef.current;
			if (sg && rootRef.current) {
				const map = sg.getShadowMap();
				if (map && map.renderList) { map.renderList.length = 0; }
				sg.addShadowCaster(rootRef.current, true);
			}
			if (groundRef.current) (groundRef.current as any).receiveShadows = true;
		} catch {}
	}, [skinId, colorsMemo, rotationSpeed, scale, mode, showBaseModel]);

	const handleSave = async () => {
		const primary = fromHex(primaryHex, storeColors.primary);
		const secondary = fromHex(secondaryHex, storeColors.secondary);
		setSkinId(skinId);
		setColors({ primary, secondary });
		try {
			if (authUser) {
				await authUpdateProfile({ skinId: skinId, skinPrimary: primary, skinSecondary: secondary } as any);
			}
			toast({ title: 'Zapisano', description: authUser ? 'Skin zapisany w koncie.' : 'Skin zapisany lokalnie.' });
		} catch (e: any) {
			toast({ title: 'Błąd zapisu', description: e?.message || 'Nie udało się zapisać', variant: 'destructive' });
		}
	};

	const handleReset = () => {
		setLocalSkinId('boy');
		setPrimaryHex('#3B82F6');
		setSecondaryHex('#60A5FA');
		setHeadType('cube');
		setBodyType('normal');
		setLimbStyle('block');
		setHat('none');
		setBack('none');
		setEyes('dot');
		setMouth('smile');
		setVoxels({});
	};

	const handleRandomize = () => {
		const rand = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
		setPrimaryHex(rand());
		setSecondaryHex(rand());
	};

	const handleUndo = () => {
		setUndoStack(prev => {
			if (prev.length === 0) return prev;
			const last = prev[prev.length - 1];
			setRedoStack(r => [...r, voxelsRef.current]);
			setVoxels(last);
			return prev.slice(0, prev.length - 1);
		});
	};
	const handleRedo = () => {
		setRedoStack(prev => {
			if (prev.length === 0) return prev;
			const last = prev[prev.length - 1];
			setUndoStack(u => [...u, voxelsRef.current]);
			setVoxels(last);
			return prev.slice(0, prev.length - 1);
		});
	};

	// Backend RLE export/import
	const buildLinearScanOrder = () => {
		const xMin = -Math.floor(voxelBounds.x / 2), xMax = Math.floor(voxelBounds.x / 2);
		const zMin = -Math.floor(voxelBounds.z / 2), zMax = Math.floor(voxelBounds.z / 2);
		const yMin = 0, yMax = voxelBounds.y - 1;
		return { xMin, xMax, yMin, yMax, zMin, zMax };
	};
	const getRLEPayload = () => {
		const { xMin, xMax, yMin, yMax, zMin, zMax } = buildLinearScanOrder();
		const valueAt = (x:number,y:number,z:number): number => {
			const k = makeKey(x,y,z);
			const c = voxels[k];
			if (typeof c === 'number') return c + 1; // 0=empty, 1..=palette index+1
			if (c === 'primary') return 1; if (c === 'secondary') return 2; return 0;
		};
		const runs: Array<[number, number]> = [];
		let current = -1; let count = 0;
		for (let y=yMin; y<=yMax; y++) {
			for (let z=zMin; z<=zMax; z++) {
				for (let x=xMin; x<=xMax; x++) {
					const v = valueAt(x,y,z);
					if (current === -1) { current = v; count = 1; }
					else if (v === current) { count++; }
					else { runs.push([current, count]); current = v; count = 1; }
				}
			}
		}
		if (current !== -1) runs.push([current, count]);
		return {
			version: 1,
			voxelSize,
			bounds: voxelBounds,
			palette,
			layers: { legs: [0,7], torso: [8,15], head: [16,23] },
			order: 'y-z-x',
			voxelsRLE: runs,
		};
	};
	const exportRLE = () => {
		const payload = getRLEPayload();
		try { navigator.clipboard.writeText(JSON.stringify(payload)); toast({ title: 'Wyeksportowano (RLE)', description: 'Skopiowano JSON do schowka.' }); } catch {}
	};
	const importRLE = () => {
		const data = prompt('Wklej RLE JSON:'); if (!data) return;
		try {
			const obj = JSON.parse(data);
			if (!obj || !Array.isArray(obj.voxelsRLE)) throw new Error('Brak voxelsRLE');
			const result = decodeVoxelsRLE(obj.voxelsRLE, voxelBounds);
			setVoxels(result as Record<VoxelKey, VoxelColor>);
			if (Array.isArray(obj.palette)) setPalette(obj.palette);
			toast({ title: 'Zaimportowano (RLE)', description: 'Voxele z RLE załadowane.' });
		} catch (e:any) {
			toast({ title: 'Błąd importu', description: e?.message || 'Nieprawidłowy format', variant: 'destructive' });
		}
	};

	// Backend account save/load for RLE
	const handleSaveRLEToAccount = async () => {
		try {
			if (!authUser) { toast({ title: 'Wymagane logowanie', description: 'Zaloguj się, aby zapisać do konta', variant: 'destructive' }); return; }
			const payload = getRLEPayload();
			const mergedCfg = { ...(storeConfig || {}), voxels: payload } as any;
			await authUpdateProfile({ skinConfig: mergedCfg } as any);
			toast({ title: 'Zapisano do konta', description: 'RLE zapisane w profilu' });
		} catch (e:any) {
			toast({ title: 'Błąd zapisu', description: e?.message || 'Nie udało się zapisać', variant: 'destructive' });
		}
	};
	const handleLoadRLEFromAccount = async () => {
		try {
			if (!authUser) { toast({ title: 'Wymagane logowanie', description: 'Zaloguj się, aby wczytać z konta', variant: 'destructive' }); return; }
			const resp = await AuthService.getMe();
			const sc = (resp?.user as any)?.skinConfig;
			let cfg: any = sc;
			if (typeof sc === 'string') { try { cfg = JSON.parse(sc); } catch {} }
			const payload = cfg?.voxels;
			if (payload && Array.isArray(payload.voxelsRLE)) {
				const result = decodeVoxelsRLE(payload.voxelsRLE, voxelBounds);
				setVoxels(result as Record<VoxelKey, VoxelColor>);
				if (Array.isArray(payload.palette)) setPalette(payload.palette);
				toast({ title: 'Załadowano z konta', description: 'RLE wczytane z profilu' });
			} else {
				toast({ title: 'Brak danych RLE', description: 'Nie znaleziono voxelsRLE w profilu', variant: 'destructive' });
			}
		} catch (e:any) {
			toast({ title: 'Błąd wczytywania', description: e?.message || 'Nie udało się wczytać', variant: 'destructive' });
		}
	};

	const savePresets = (arr: SkinPreset[]) => {
		setPresets(arr);
		try { localStorage.setItem('skin-presets', JSON.stringify(arr)); } catch {}
	};

	const handlePresetSave = () => {
		const name = prompt('Nazwa presetu:', 'Mój skin');
		if (!name) return;
		const p: SkinPreset = { id: Date.now().toString(36), name, skinId, primary: primaryHex, secondary: secondaryHex };
		savePresets([p, ...presets]);
		setSelectedPresetId(p.id);
	};

	const handlePresetLoad = (id: string) => {
		const p = presets.find(x => x.id === id);
		if (!p) return;
		setSelectedPresetId(id);
		setLocalSkinId(p.skinId);
		setPrimaryHex(p.primary);
		setSecondaryHex(p.secondary);
	};

	const handlePresetDelete = (id: string) => {
		const arr = presets.filter(x => x.id !== id);
		savePresets(arr);
		if (selectedPresetId === id) setSelectedPresetId('');
	};

	const handleExportVoxels = () => {
		try {
			const data = JSON.stringify({ voxels, voxelSize });
			navigator.clipboard.writeText(data);
			toast({ title: 'Wyeksportowano', description: 'Dane voxel skopiowane do schowka.' });
		} catch {}
	};
	const handleImportVoxels = () => {
		const data = prompt('Wklej dane voxeli (JSON):');
		if (!data) return;
		try {
			const parsed = JSON.parse(data);
			if (parsed && parsed.voxels) setVoxels(parsed.voxels);
			toast({ title: 'Zaimportowano', description: 'Voxele załadowane.' });
		} catch {
			toast({ title: 'Błąd importu', description: 'Nieprawidłowy format', variant: 'destructive' });
		}
	};

	return (
		<PageTransition>
			<div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
				<canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />
				<div className="absolute top-4 right-4 w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto rounded-lg bg-white/5 border border-white/10 p-4 backdrop-blur z-10">
					<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'editor' | 'library' | 'marketplace')} className="space-y-4">
					<TabsList className="grid grid-cols-3 gap-2">
						<TabsTrigger value="editor">Edytor</TabsTrigger>
						<TabsTrigger value="library">Moje skiny</TabsTrigger>
						<TabsTrigger value="marketplace">Marketplace</TabsTrigger>
					</TabsList>
					<TabsContent value="editor" className="space-y-6">
						<div className="grid grid-cols-2 gap-2">
							<Button variant={mode === 'preview' ? 'default' : 'outline'} onClick={() => setMode('preview')}>Podgląd</Button>
							<Button variant={mode === 'edit' ? 'default' : 'outline'} onClick={() => setMode('edit')}>Edycja</Button>
						</div>
						<div className="flex items-center justify-between">
							<Label>Pokaż model bazowy</Label>
							<input type="checkbox" checked={showBaseModel} onChange={(e) => setShowBaseModel(e.target.checked)} />
						</div>
						<div className="space-y-2">
							<Label>Jakość sceny</Label>
							<select
								value={quality}
								onChange={(e) => setQuality(e.target.value as any)}
								className="w-full bg-white/10 border border-white/10 rounded px-2 py-2"
							>
								<option value="high">Wysoka</option>
								<option value="medium">Średnia</option>
								<option value="low">Niska</option>
							</select>
						</div>
						<div className="space-y-2">
							<Label>Skin</Label>
							<select
								value={skinId}
								onChange={(e) => {
									const v = e.target.value as any;
									setLocalSkinId(v as any);
								}}
								className="w-full bg-white/10 border border-white/10 rounded px-2 py-2"
							>
								<option value="boy">Chłopiec</option>
								<option value="girl">Dziewczynka</option>
							</select>
						</div>
						{/* Removed useKogama logic from UI */}
						{mode === 'edit' && (
							<div className="space-y-3 border-t border-white/10 pt-3">
								<Label>Narzędzia</Label>
								<div className="grid grid-cols-3 gap-2">
									<Button variant={tool==='add'?'default':'outline'} onClick={()=>setTool('add')}>Dodaj</Button>
									<Button variant={tool==='remove'?'default':'outline'} onClick={()=>setTool('remove')}>Usuń</Button>
									<Button variant={tool==='paint'?'default':'outline'} onClick={()=>setTool('paint')}>Maluj</Button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Button variant="outline" onClick={handleUndo} disabled={undoStack.length===0}>Cofnij</Button>
									<Button variant="outline" onClick={handleRedo} disabled={redoStack.length===0}>Ponów</Button>
								</div>
								<div className="space-y-2">
									<Label>Pędzel</Label>
									<div className="grid grid-cols-4 gap-2">
										<Button variant={brush==='point'?'default':'outline'} onClick={()=>setBrush('point')}>Punkt</Button>
										<Button variant={brush==='line'?'default':'outline'} onClick={()=>setBrush('line')}>Linia</Button>
										<Button variant={brush==='rect'?'default':'outline'} onClick={()=>setBrush('rect')}>Prostokąt</Button>
										<Button variant={brush==='sphere'?'default':'outline'} onClick={()=>setBrush('sphere')}>Sfera</Button>
									</div>
								</div>
								<div className="space-y-2">
									<Label>Ograniczenie osi</Label>
									<select className="w-full bg-white/10 border border-white/10 rounded px-2 py-2" value={axisLock} onChange={(e)=>setAxisLock(e.target.value as AxisLock)}>
										<option value="auto">Auto</option>
										<option value="x">X</option>
										<option value="y">Y</option>
										<option value="z">Z</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label>Warstwa</Label>
									<select className="w-full bg-white/10 border border-white/10 rounded px-2 py-2" value={activeLayer} onChange={(e)=>setActiveLayer(e.target.value as ActiveLayer)}>
										<option value="all">Wszystkie</option>
										<option value="legs">Nogi</option>
										<option value="torso">Tułów</option>
										<option value="head">Głowa</option>
									</select>
								</div>
								<div className="space-y-2">
									<Label>Paleta kolorów (16)</Label>
									<div className="grid grid-cols-8 gap-2">
										{palette.map((c, i) => (
											<div key={i} className={`flex items-center gap-1 ${selectedColorIndex===i ? 'ring-2 ring-white/70 rounded' : ''}`}>
												<button className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: c }} onClick={() => setSelectedColorIndex(i)} />
												<input type="color" value={c} onChange={(e)=>setPalette(prev=>{ const n=prev.slice(); n[i]=e.target.value; return n; })} className="w-6 h-6 opacity-70" />
											</div>
										))}
									</div>
								</div>
								{brush === 'sphere' && (
									<div className="space-y-2">
										<Label>Promień pędzla</Label>
										<input type="range" min={1} max={6} step={1} value={brushRadius} onChange={(e)=>setBrushRadius(parseInt(e.target.value,10))} />
										<div className="text-xs text-white/60">{brushRadius}</div>
									</div>
								)}
								<div className="flex items-center justify-between">
									<Label>Siatka segmentów</Label>
									<input type="checkbox" checked={showGrid} onChange={(e)=>setShowGrid(e.target.checked)} />
								</div>
								<div className="flex items-center justify-between">
									<Label>Snap do segmentów</Label>
									<input type="checkbox" checked={snapToSegments} onChange={(e)=>setSnapToSegments(e.target.checked)} />
								</div>
								<div className="grid grid-cols-3 gap-2">
									<Button variant="outline" onClick={()=>setVoxels({})}>Wyczyść</Button>
									<Button variant="outline" onClick={handleExportVoxels}>Eksport</Button>
									<Button variant="outline" onClick={handleImportVoxels}>Import</Button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Button variant="outline" onClick={exportRLE}>Eksport RLE</Button>
									<Button variant="outline" onClick={importRLE}>Import RLE</Button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<Button onClick={handleSaveRLEToAccount}>Zapisz do konta</Button>
									<Button variant="outline" onClick={handleLoadRLEFromAccount}>Wczytaj z konta</Button>
								</div>
							</div>
						)}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Skala podglądu</Label>
								<input type="range" min={0.5} max={2} step={0.05} value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} />
								<div className="text-xs text-white/60">{scale.toFixed(2)}x</div>
							</div>
							<div className="space-y-2">
								<Label>Prędkość rotacji</Label>
								<input type="range" min={0} max={0.01} step={0.0005} value={rotationSpeed} onChange={(e) => setRotationSpeed(parseFloat(e.target.value))} />
								<div className="text-xs text-white/60">{rotationSpeed.toFixed(4)}</div>
							</div>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Primary</Label>
								<div className="flex items-center gap-2">
									<Input value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="bg-white/10 border-white/10" />
									<input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} />
								</div>
							</div>
							<div className="space-y-2">
								<Label>Secondary</Label>
								<div className="flex items-center gap-2">
									<Input value={secondaryHex} onChange={(e) => setSecondaryHex(e.target.value)} className="bg-white/10 border-white/10" />
									<input type="color" value={secondaryHex} onChange={(e) => setSecondaryHex(e.target.value)} />
								</div>
							</div>
						</div>
						<div className="flex gap-2 pt-2 flex-wrap">
							<Button onClick={handleSave}>Zapisz</Button>
							<Button variant="outline" onClick={handleReset}>Reset</Button>
							<Button variant="outline" onClick={handleRandomize}>Losuj kolory</Button>
							<Button variant="outline" onClick={() => { try { navigator.clipboard.writeText(`${primaryHex},${secondaryHex}`);} catch {} }}>Kopiuj kolory</Button>
							<Button variant="ghost" onClick={() => setActiveTab('library')}>Otworz Moje skiny</Button>
							<Button variant="ghost" onClick={() => setActiveTab('marketplace')}>Przejdz do marketplace</Button>
						</div>
						<div className="space-y-2 pt-4">
							<div className="flex items-center justify-between">
								<Label>Presety</Label>
								<Button size="sm" variant="outline" onClick={handlePresetSave}>Zapisz jako preset</Button>
							</div>
							<div className="space-y-2 max-h-48 overflow-auto pr-1">
								{presets.length === 0 ? (
									<div className="text-xs text-white/60">Brak presetów</div>
								) : presets.map(p => (
									<div key={p.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${selectedPresetId === p.id ? 'bg-white/10' : 'bg-white/5'}`}>
										<button className="text-left flex-1 text-sm" onClick={() => handlePresetLoad(p.id)}>
											{p.name}
											<span className="ml-2 text-xs opacity-60">({p.skinId})</span>
										</button>
										<div className="flex items-center gap-1">
											<div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: p.primary }} />
											<div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: p.secondary }} />
											<Button size="sm" variant="ghost" onClick={() => handlePresetDelete(p.id)}>Usuń</Button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="library" className="space-y-4">
					{!authUser ? (
						<Card className="bg-white/5 border-white/10">
							<CardHeader>
								<CardTitle>Wymagane logowanie</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-white/70">Zaloguj sie, aby zarzadzac zapisanymi skinami.</CardContent>
						</Card>
					) : (
						<>
							<div className="space-y-3">
								<div className="space-y-1">
									<Label htmlFor="new-skin-name">Nazwa nowego skina</Label>
									<Input id="new-skin-name" value={newSkinName} onChange={(e) => setNewSkinName(e.target.value)} placeholder="Moj epicki skin" />
								</div>
								<div className="flex flex-wrap gap-2">
									<Button onClick={() => handleCreateSkinEntry(newSkinName, false)} disabled={isActionBusy('skin-create') || !newSkinName.trim()}>
										{isActionBusy('skin-create') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Zapisz szkic
									</Button>
									<Button variant="outline" onClick={() => handleCreateSkinEntry(newSkinName, true)} disabled={isActionBusy('skin-create') || !newSkinName.trim()}>
										{isActionBusy('skin-create') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Publikuj
									</Button>
									<Button variant="ghost" onClick={() => refreshMySkins()} disabled={mySkinsLoading}>
										{mySkinsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Odswiez liste
									</Button>
								</div>
								<p className="text-xs text-white/60">Miniatura generowana jest na podstawie aktualnego widoku kanwy.</p>
							</div>
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<Input placeholder="Szukaj po nazwie lub ID" value={mySkinsSearch} onChange={(e) => setMySkinsSearch(e.target.value)} />
								<Select value={mySkinsFilter} onValueChange={(value) => setMySkinsFilter(value as SkinVisibilityFilter)}>
									<SelectTrigger className="bg-white/10 border-white/10">
										<SelectValue placeholder="Filtruj" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Wszystkie</SelectItem>
										<SelectItem value="draft">Szkice</SelectItem>
										<SelectItem value="published">Opublikowane</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-3">
								{mySkinsLoading ? (
									<>
										<Skeleton className="h-36 w-full" />
										<Skeleton className="h-36 w-full" />
									</>
								) : filteredMySkins.length === 0 ? (
									<p className="text-sm text-white/60">Brak skinow spelniajacych kryteria.</p>
								) : (
									filteredMySkins.map(skin => (
										<MySkinCard
                                    key={skin.id}
                                    skin={skin}
                                    onLoad={(s) => { handleLoadSkinRecord(s); setActiveTab('editor'); }}
                                    onApply={(s) => handleApplySkinFromEditor(s)}
                                    onTogglePublish={(s, publish) => handleTogglePublishState(s, publish)}
                                    onDelete={(s) => handleDeleteSkinEntry(s)}
                                    onCreateListing={(s, price) => handleCreateListingForSkin(s, price)}
                                    onUpdateListing={(s, listingId, price) => handleUpdateListingPrice(s, listingId, price)}
                                    onCancelListing={(s, listingId) => handleCancelListingAction(s, listingId)}
                                    isBusy={isActionBusy}
                                />
                            ))
                        )}
                    </div>
                </>
            )}
        </TabsContent>
        <TabsContent value="marketplace" className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input placeholder="Szukaj w marketplace" value={marketplaceSearch} onChange={(e) => setMarketplaceSearch(e.target.value)} />
                <Select value={marketplaceFilter} onValueChange={(value) => setMarketplaceFilter(value as 'available' | 'all' | 'owned')}>
                    <SelectTrigger className="bg-white/10 border-white/10">
                        <SelectValue placeholder="Filtr" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="available">Dostepne</SelectItem>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        <SelectItem value="owned">Moje oferty</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={marketplaceSort} onValueChange={(value) => setMarketplaceSort(value as 'recent' | 'price-asc' | 'price-desc')}>
                    <SelectTrigger className="bg-white/10 border-white/10">
                        <SelectValue placeholder="Sortowanie" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent">Najnowsze</SelectItem>
                        <SelectItem value="price-asc">Cena rosnaco</SelectItem>
                        <SelectItem value="price-desc">Cena malejaco</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="ghost" onClick={() => refreshMarketplace()} disabled={marketplaceLoading}>
                    {marketplaceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Odswiez
                </Button>
            </div>
            <div className="space-y-3">
                {marketplaceLoading ? (
                    <>
                        <Skeleton className="h-36 w-full" />
                        <Skeleton className="h-36 w-full" />
                    </>
                ) : filteredMarketplace.length === 0 ? (
                    <p className="text-sm text-white/60">Brak ofert spelniajacych kryteria.</p>
                ) : (
                    filteredMarketplace.map(listing => (
                        <MarketplaceCard
                            key={listing.id}
                            listing={listing}
                            currentUserId={authUser?.id}
                            onPreview={(item) => handlePreviewListing(item)}
                            onPurchase={(item) => handlePurchaseListing(item)}
                            isBusy={isActionBusy}
                        />
                    ))
                )}
            </div>
        </TabsContent>
        </Tabs>
			</div>
		</PageTransition>
	);
};

export default SkinStudio;










