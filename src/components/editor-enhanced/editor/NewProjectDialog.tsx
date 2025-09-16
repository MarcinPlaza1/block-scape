import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/features/projects/stores';
import { useToast } from '@/hooks/use-toast';
import { createFromPreset, getPresetMeta, PresetId } from '@/features/projects/presets';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ open, onOpenChange }) => {
  const { hasUnsavedChanges, blocks, newProject, setBlocks, setProjectName } = useProjectStore();
  const { toast } = useToast();
  const [preset, setPreset] = React.useState<PresetId>('empty');
  const [name, setName] = React.useState<string>('Nowy projekt');
  const [confirmNeeded, setConfirmNeeded] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setConfirmNeeded(hasUnsavedChanges || (blocks?.length || 0) > 0);
    setName('Nowy projekt');
    setPreset('empty');
  }, [open, hasUnsavedChanges, blocks?.length]);

  const handleCreate = () => {
    if (confirmNeeded) {
      const ok = confirm('Masz niezapisane zmiany lub klocki na scenie. Na pewno utworzyć nowy projekt?');
      if (!ok) return;
    }

    const starter = createFromPreset(preset, name);
    newProject();
    setProjectName(starter.name);
    setBlocks(starter.blocks);
    toast({ title: 'Utworzono projekt', description: starter.name });
    onOpenChange(false);
  };

  const presets = getPresetMeta();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Nowy projekt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nazwa projektu</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Podaj nazwę" />
          </div>

          <div className="space-y-2">
            <Label>Starter kit</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as PresetId)}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {confirmNeeded && (
            <div className="text-yellow-300 text-sm bg-yellow-900/40 border border-yellow-800 rounded px-3 py-2">
              Masz niezapisane zmiany lub elementy na scenie. Utworzenie nowego projektu wyczyści scenę.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleCreate}>Utwórz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectDialog;


