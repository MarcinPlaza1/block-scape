import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProjectStore } from '@/features/projects/stores';
import { gamesApi } from '@/shared/api/client';
import { friendsApi } from '@/shared/api/friends';
import { ProjectService } from '@/services/api.service';

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const {
    projectName,
    currentProject,
    renameProject,
    saveProject,
    publishProject,
    setGameMode,
  } = useProjectStore();

  const [name, setName] = React.useState(projectName);
  const [visibility, setVisibility] = React.useState<'PRIVATE'|'FRIENDS'|'PUBLIC'>(
    (currentProject as any)?.visibility || 'PRIVATE'
  );
  const [published, setPublished] = React.useState<boolean>(!!currentProject?.published);
  const [saving, setSaving] = React.useState(false);
  const [thumbFile, setThumbFile] = React.useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'PARKOUR'|'PVP'|'RACE'|'SANDBOX'>(((currentProject as any)?.mode as any) || 'PARKOUR');
  const [modeConfig, setModeConfig] = React.useState<string>((currentProject as any)?.modeConfig || '');

  const [friends, setFriends] = React.useState<Array<{ id: string; name: string }>>([]);
  const [shareFriendId, setShareFriendId] = React.useState<string>('');
  const [shareRole, setShareRole] = React.useState<'VIEWER'|'EDITOR'>('VIEWER');
  const [shareSaving, setShareSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(projectName);
    setVisibility(((currentProject as any)?.visibility as any) || 'PRIVATE');
    setPublished(!!currentProject?.published);
    setMode((((currentProject as any)?.mode as any) || 'PARKOUR'));
    setModeConfig(((currentProject as any)?.modeConfig || ''));
  }, [open, projectName, currentProject]);

  const handleCaptureFromScene = () => {
    try {
      const dataUrl = (window as any).scene3D?.captureThumbnail?.({ type: 'image/jpeg', quality: 0.85 });
      if (dataUrl) {
        setThumbPreview(dataUrl);
        setThumbFile(null);
      }
    } catch {}
  };

  const handleThumbFile = (file: File | null) => {
    setThumbFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setThumbPreview(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(file);
    } else {
      setThumbPreview(null);
    }
  };

  const handleSave = async () => {
    if (!currentProject?.id) {
      // No cloud id yet, perform a save to create
      setSaving(true);
      try {
        if (mode) setGameMode(mode);
        const result = await saveProject();
        toast({ title: 'Zapisano projekt', description: result.project.name });
      } catch (e: any) {
        toast({ title: 'Błąd zapisu', description: e?.message || 'Spróbuj ponownie', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      if (name && name !== projectName) {
        renameProject(name);
      }

      let thumbnail: string | undefined;
      if (thumbPreview) thumbnail = thumbPreview;

      await ProjectService.updateProject(currentProject.id, { name, ...(thumbnail ? { thumbnail } : {}), visibility, mode, ...(modeConfig ? { modeConfig } : {}) });

      // Publish toggle may also be requested
      if (published !== !!currentProject.published) {
        await publishProject(published);
      }

      toast({ title: 'Zapisano ustawienia projektu' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Nie udało się zapisać', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleVisibility = async (value: 'PRIVATE'|'FRIENDS'|'PUBLIC') => {
    setVisibility(value);
    if (!currentProject?.id) return;
    try {
      await gamesApi.updateVisibility(currentProject.id, value);
      toast({ title: 'Zaktualizowano widoczność' });
    } catch (e: any) {
      toast({ title: 'Błąd zmiany widoczności', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const loadFriends = async () => {
    try {
      const resp = await friendsApi.getFriends();
      setFriends(resp.friends?.map(f => ({ id: f.id, name: f.name })) || []);
    } catch {
      setFriends([]);
    }
  };

  React.useEffect(() => {
    if (open) loadFriends();
  }, [open]);

  const handleShare = async () => {
    if (!currentProject?.id || !shareFriendId) return;
    setShareSaving(true);
    try {
      await gamesApi.share(currentProject.id, shareFriendId, shareRole);
      toast({ title: 'Udostępniono znajomemu' });
      setShareFriendId('');
    } catch (e: any) {
      toast({ title: 'Nie udało się udostępnić', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    } finally {
      setShareSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentProject?.id) return;
    if (!confirm('Na pewno usunąć projekt? Tej operacji nie można cofnąć.')) return;
    try {
      await ProjectService.deleteProject(currentProject.id);
      toast({ title: 'Usunięto projekt' });
      // Reset local state
      window.location.href = '/';
    } catch (e: any) {
      toast({ title: 'Nie udało się usunąć', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Ustawienia projektu</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <Label>Nazwa projektu</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wpisz nazwę" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Widoczność</Label>
              <Select value={visibility} onValueChange={(v) => handleVisibility(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz widoczność" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Prywatna</SelectItem>
                  <SelectItem value="FRIENDS">Znajomi</SelectItem>
                  <SelectItem value="PUBLIC">Publiczna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant={published ? 'default' : 'secondary'} onClick={() => setPublished(true)}>Publikuj</Button>
              <Button variant={!published ? 'default' : 'secondary'} onClick={() => setPublished(false)}>Wycofaj</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>Tryb gry</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz tryb" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARKOUR">Parkour</SelectItem>
                  <SelectItem value="PVP">PvP</SelectItem>
                  <SelectItem value="RACE">Wyścigi</SelectItem>
                  <SelectItem value="SANDBOX">Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Konfiguracja trybu (JSON)</Label>
              <Input value={modeConfig} onChange={(e) => setModeConfig(e.target.value)} placeholder='Np. {"laps":3}' />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Miniatura projektu</Label>
            {thumbPreview && (
              <img src={thumbPreview} alt="Podgląd miniatury" className="w-full h-36 object-cover rounded border border-white/10" />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCaptureFromScene}>Przechwyć z aktualnej sceny</Button>
              <label className="inline-flex">
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleThumbFile(e.target.files?.[0] || null)} />
                <span className="inline-flex items-center justify-center px-3 py-2 rounded bg-gray-700 text-gray-100 hover:bg-gray-600 cursor-pointer">Wgraj obraz</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Udostępnij znajomemu</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={shareFriendId} onValueChange={setShareFriendId}>
                <SelectTrigger className="col-span-2">
                  <SelectValue placeholder="Wybierz znajomego" />
                </SelectTrigger>
                <SelectContent>
                  {friends.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={shareRole} onValueChange={(v) => setShareRole(v as 'VIEWER'|'EDITOR')}>
                <SelectTrigger>
                  <SelectValue placeholder="Rola" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Podgląd</SelectItem>
                  <SelectItem value="EDITOR">Edycja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button onClick={handleShare} disabled={!shareFriendId || shareSaving}>Udostępnij</Button>
            </div>
          </div>

          <div className="pt-2">
            <Button variant="destructive" onClick={handleDelete}>Usuń projekt</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving}>Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectSettingsDialog;


