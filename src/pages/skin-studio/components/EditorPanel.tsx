import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EditorState, AxisLock } from "../types";
import type { ActiveLayer } from "@/pages/skin-studio/lib/voxel-utils";

interface EditorPanelProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  editor: EditorState;
  onOpenLibrary: () => void;
  onOpenMarketplace: () => void;
}

const QUALITY_PRESETS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const MODE_OPTIONS = [
  { value: "preview", label: "Preview" },
  { value: "edit", label: "Edit" },
] as const;

const LAYER_OPTIONS: { value: ActiveLayer; label: string }[] = [
  { value: "all", label: "All" },
  { value: "legs", label: "Legs" },
  { value: "torso", label: "Torso" },
  { value: "head", label: "Head" },
];

const AXIS_OPTIONS: { value: AxisLock; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "x", label: "X" },
  { value: "y", label: "Y" },
  { value: "z", label: "Z" },
];

const TOOL_OPTIONS = [
  { value: "add", label: "Add" },
  { value: "remove", label: "Remove" },
  { value: "paint", label: "Paint" },
] as const;

const BRUSH_OPTIONS = [
  { value: "point", label: "Point" },
  { value: "line", label: "Line" },
  { value: "rect", label: "Rect" },
  { value: "sphere", label: "Sphere" },
] as const;

const formatDisplayHex = (value: string) => (value.startsWith("#") ? value : `#${value}`);

const EditorPanel = ({ canvasRef, editor, onOpenLibrary, onOpenMarketplace }: EditorPanelProps) => {
  const {
    mode,
    setMode,
    showBaseModel,
    setShowBaseModel,
    quality,
    setQuality,
    appearance,
    voxels,
    presets,
  } = editor;

  const {
    skinId,
    setSkinId,
    primaryHex,
    setPrimaryHex,
    secondaryHex,
    setSecondaryHex,
    scale,
    setScale,
    rotationSpeed,
    setRotationSpeed,
    save,
    reset,
    randomize,
  } = appearance;

  const {
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
    clear,
    exportVoxels,
    importVoxels,
    exportRLE,
    importRLE,
    saveRLEToAccount,
    loadRLEFromAccount,
    undoRedo,
  } = voxels;

  const {
    presets: presetList,
    selectedPresetId,
    savePreset,
    loadPreset,
    deletePreset,
  } = presets;

  const handleCopyColors = () => {
    try {
      navigator.clipboard.writeText(`${primaryHex},${secondaryHex}`);
    } catch {
      /* ignore clipboard errors */
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/40">
            <canvas ref={canvasRef} className="h-[480px] w-full bg-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/40 to-transparent p-4">
              <div className="flex flex-wrap items-center gap-2">
                {MODE_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={mode === value ? "default" : "outline"}
                    onClick={() => setMode(value)}
                    className="pointer-events-auto"
                  >
                    {label}
                  </Button>
                ))}
                <div className="ml-auto flex items-center gap-3 text-xs text-white/80">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showBaseModel}
                      onChange={(event) => setShowBaseModel(event.target.checked)}
                    />
                    Show base model
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mirrorX}
                      onChange={(event) => setMirrorX(event.target.checked)}
                    />
                    Mirror X
                  </label>
                </div>
              </div>
            </div>
          </div>
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white/90">Renderer & Quality</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUALITY_PRESETS.map(({ value, label }) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={quality === value ? "default" : "outline"}
                    onClick={() => setQuality(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={showBaseModel}
                  onChange={(event) => setShowBaseModel(event.target.checked)}
                />
                Show base mesh
              </label>
            </CardContent>
          </Card>
          {mode === "edit" ? (
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-white/90">Voxel Editing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tools</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TOOL_OPTIONS.map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={tool === value ? "default" : "outline"}
                        onClick={() => setTool(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={undoRedo.undo} disabled={!undoRedo.canUndo}>
                      Undo
                    </Button>
                    <Button variant="outline" onClick={undoRedo.redo} disabled={!undoRedo.canRedo}>
                      Redo
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Brush</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {BRUSH_OPTIONS.map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={brush === value ? "default" : "outline"}
                        onClick={() => setBrush(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Axis lock</Label>
                    <select
                      className="w-full rounded border border-white/10 bg-white/10 px-2 py-2 text-sm"
                      value={axisLock}
                      onChange={(event) => setAxisLock(event.target.value as AxisLock)}
                    >
                      {AXIS_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Layer</Label>
                    <select
                      className="w-full rounded border border-white/10 bg-white/10 px-2 py-2 text-sm"
                      value={activeLayer}
                      onChange={(event) => setActiveLayer(event.target.value as ActiveLayer)}
                    >
                      {LAYER_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Palette</Label>
                  <div className="grid grid-cols-8 gap-2">
                    {palette.map((color, index) => (
                      <div
                        key={index}
                        className={
                          cn(
                            "flex items-center gap-1 rounded border border-white/10 p-1",
                            selectedColorIndex === index ? "ring-2 ring-white/80" : "bg-black/20",
                          )
                        }
                      >
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-white/30"
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedColorIndex(index)}
                        />
                        <input
                          aria-label={`Palette color ${index + 1}`}
                          className="h-6 w-6 cursor-pointer opacity-80"
                          type="color"
                          value={formatDisplayHex(color)}
                          onChange={(event) => setPaletteColor(index, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {brush === "sphere" ? (
                  <div className="space-y-1">
                    <Label>Brush radius</Label>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={brushRadius}
                      onChange={(event) => setBrushRadius(parseInt(event.target.value, 10))}
                    />
                    <div className="text-xs text-white/70">Radius: {brushRadius}</div>
                  </div>
                ) : null}
                <div className="space-y-2 text-sm text-white/80">
                  <label className="flex items-center justify-between">
                    <span>Show grid</span>
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(event) => setShowGrid(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Snap to segments</span>
                    <input
                      type="checkbox"
                      checked={snapToSegments}
                      onChange={(event) => setSnapToSegments(event.target.checked)}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={clear}>
                    Clear
                  </Button>
                  <Button variant="outline" onClick={exportVoxels}>
                    Export
                  </Button>
                  <Button variant="outline" onClick={importVoxels}>
                    Import
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={exportRLE}>
                    Export RLE
                  </Button>
                  <Button variant="outline" onClick={importRLE}>
                    Import RLE
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={saveRLEToAccount}>Save to account</Button>
                  <Button variant="outline" onClick={loadRLEFromAccount}>
                    Load from account
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white/90">Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              <div className="space-y-2">
                <Label>Base skin</Label>
                <select
                  className="w-full rounded border border-white/10 bg-white/10 px-2 py-2 text-sm"
                  value={skinId}
                  onChange={(event) => setSkinId(event.target.value as typeof skinId)}
                >
                  <option value="boy">Boy</option>
                  <option value="girl">Girl</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Scale</Label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={scale}
                    onChange={(event) => setScale(parseFloat(event.target.value))}
                  />
                  <div className="text-xs text-white/70">{scale.toFixed(2)}x</div>
                </div>
                <div className="space-y-2">
                  <Label>Rotation speed</Label>
                  <input
                    type="range"
                    min={0}
                    max={0.01}
                    step={0.0005}
                    value={rotationSpeed}
                    onChange={(event) => setRotationSpeed(parseFloat(event.target.value))}
                  />
                  <div className="text-xs text-white/70">{rotationSpeed.toFixed(4)}</div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={primaryHex}
                      onChange={(event) => setPrimaryHex(event.target.value)}
                      className="bg-white/10 text-white"
                    />
                    <input
                      type="color"
                      value={formatDisplayHex(primaryHex)}
                      onChange={(event) => setPrimaryHex(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={secondaryHex}
                      onChange={(event) => setSecondaryHex(event.target.value)}
                      className="bg-white/10 text-white"
                    />
                    <input
                      type="color"
                      value={formatDisplayHex(secondaryHex)}
                      onChange={(event) => setSecondaryHex(event.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save}>Save</Button>
                <Button variant="outline" onClick={reset}>
                  Reset
                </Button>
                <Button variant="outline" onClick={randomize}>
                  Randomize
                </Button>
                <Button variant="outline" onClick={handleCopyColors}>
                  Copy colors
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                <Button variant="ghost" size="sm" onClick={onOpenLibrary}>
                  Open my skins
                </Button>
                <Button variant="ghost" size="sm" onClick={onOpenMarketplace}>
                  Go to marketplace
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white/90">Presets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <p className="text-xs text-white/70">
                  Save frequently used combinations of colors and base skin.
                </p>
                <Button size="sm" variant="outline" onClick={savePreset}>
                  Save preset
                </Button>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {presetList.length === 0 ? (
                  <p className="text-xs text-white/60">No presets yet.</p>
                ) : (
                  presetList.map((preset) => (
                    <div
                      key={preset.id}
                      className={
                        cn(
                          "flex items-center justify-between gap-2 rounded px-2 py-1",
                          selectedPresetId === preset.id ? "bg-white/10" : "bg-white/5",
                        )
                      }
                    >
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-between text-left text-sm"
                        onClick={() => loadPreset(preset.id)}
                      >
                        <span>{preset.name}</span>
                        <span className="ml-2 text-xs text-white/60">({preset.skinId})</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="h-4 w-4 rounded border border-white/20" style={{ backgroundColor: preset.primary }} />
                        <span className="h-4 w-4 rounded border border-white/20" style={{ backgroundColor: preset.secondary }} />
                        <Button size="sm" variant="ghost" onClick={() => deletePreset(preset.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditorPanel;
