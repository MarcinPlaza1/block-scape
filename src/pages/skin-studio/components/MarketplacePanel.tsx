import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketplaceState } from "../types";
import MarketplaceCard from "./MarketplaceCard";

interface MarketplacePanelProps {
  marketplace: MarketplaceState;
  currentUserId?: string;
  isActionBusy: (key: string) => boolean;
}

const MarketplacePanel = ({ marketplace, currentUserId, isActionBusy }: MarketplacePanelProps) => {
  const {
    filter,
    setFilter,
    search,
    setSearch,
    sort,
    setSort,
    filteredListings,
    loading,
    refresh,
    actions,
  } = marketplace;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          placeholder="Search marketplace"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="border-white/10 bg-white/10">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="owned">My offers</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
          <SelectTrigger className="border-white/10 bg-white/10">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest</SelectItem>
            <SelectItem value="price-asc">Price ascending</SelectItem>
            <SelectItem value="price-desc">Price descending</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>
      <div className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </>
        ) : filteredListings.length === 0 ? (
          <p className="text-sm text-white/60">No listings match your filters.</p>
        ) : (
          filteredListings.map((listing) => (
            <MarketplaceCard
              key={listing.id}
              listing={listing}
              currentUserId={currentUserId}
              onPreview={actions.preview}
              onPurchase={actions.purchase}
              isBusy={isActionBusy}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MarketplacePanel;
