import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import MySkinCard from "./MySkinCard";
import type { LibraryState } from "../types";

interface LibraryPanelProps {
  library: LibraryState;
  isActionBusy: (key: string) => boolean;
}

const LibraryPanel = ({ library, isActionBusy }: LibraryPanelProps) => {
  const {
    isAuthenticated,
    newSkinName,
    setNewSkinName,
    filter,
    setFilter,
    search,
    setSearch,
    loading,
    refresh,
    filteredItems,
    actions,
  } = library;

  if (!isAuthenticated) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle>Login required</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-white/70">
          Sign in to manage your saved skins.
        </CardContent>
      </Card>
    );
  }

  const busyCreate = isActionBusy("skin-create");

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-white/5">
        <CardContent className="space-y-3 pt-4">
          <div className="space-y-1">
            <Label htmlFor="new-skin-name">New skin name</Label>
            <Input
              id="new-skin-name"
              value={newSkinName}
              onChange={(event) => setNewSkinName(event.target.value)}
              placeholder="My new skin"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => actions.create(newSkinName, false)}
              disabled={busyCreate || !newSkinName.trim()}
            >
              {busyCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button
              variant="outline"
              onClick={() => actions.create(newSkinName, true)}
              disabled={busyCreate || !newSkinName.trim()}
            >
              {busyCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publish
            </Button>
            <Button variant="ghost" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh list
            </Button>
          </div>
          <p className="text-xs text-white/60">
            Thumbnails are generated from the current canvas view when saving.
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          placeholder="Search by name or id"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="border-white/10 bg-white/10">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-white/60">No skins found.</p>
        ) : (
          filteredItems.map((skin) => (
            <MySkinCard
              key={skin.id}
              skin={skin}
              onLoad={actions.load}
              onApply={actions.apply}
              onTogglePublish={actions.togglePublish}
              onDelete={actions.remove}
              onCreateListing={actions.createListing}
              onUpdateListing={actions.updateListing}
              onCancelListing={actions.cancelListing}
              isBusy={isActionBusy}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default LibraryPanel;
