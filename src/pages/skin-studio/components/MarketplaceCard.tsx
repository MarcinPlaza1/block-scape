import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, type SkinListingWithSkin } from "@/types/skins";

interface MarketplaceCardProps {
  listing: SkinListingWithSkin;
  currentUserId?: string;
  onPreview: (listing: SkinListingWithSkin) => void;
  onPurchase: (listing: SkinListingWithSkin) => Promise<void> | void;
  isBusy: (key: string) => boolean;
}

const MarketplaceCard = ({
  listing,
  currentUserId,
  onPreview,
  onPurchase,
  isBusy,
}: MarketplaceCardProps) => {
  const isOwner = listing.sellerId === currentUserId;
  const busyPurchase = isBusy(`listing-purchase-${listing.id}`);

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-white/90">{listing.skin.name}</CardTitle>
          <p className="text-xs text-white/60">Listing ID: {listing.id}</p>
        </div>
        {isOwner ? <Badge variant="outline">My listing</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {listing.skin.thumbnail ? (
          <div className="relative h-36 overflow-hidden rounded border border-white/10">
            <img src={listing.skin.thumbnail} alt={listing.skin.name} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
          <span>Seller</span>
          <span className="text-right">{listing.seller?.name ?? listing.sellerId ?? "Unknown"}</span>
          <span>Created</span>
          <span className="text-right">{new Date(listing.createdAt).toLocaleDateString()}</span>
          <span>Price</span>
          <span className="text-right font-semibold text-white">{formatPrice(listing.price, listing.currency)}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onPreview(listing)}>
          Preview
        </Button>
        <Button
          size="sm"
          onClick={() => onPurchase(listing)}
          disabled={isOwner || busyPurchase}
        >
          {busyPurchase ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isOwner ? "Your listing" : "Buy"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MarketplaceCard;
