import { useMemo, useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatPrice, type SkinWithListings } from '@/types/skins';
import { Loader2 } from 'lucide-react';

interface MySkinCardProps {
  skin: SkinWithListings;
  onLoad: (skin: SkinWithListings) => void;
  onApply: (skin: SkinWithListings) => Promise<void> | void;
  onTogglePublish: (skin: SkinWithListings, publish: boolean) => Promise<void>;
  onDelete: (skin: SkinWithListings) => Promise<void>;
  onCreateListing: (skin: SkinWithListings, price: string) => Promise<void>;
  onUpdateListing: (skin: SkinWithListings, listingId: string, price: string) => Promise<void>;
  onCancelListing: (skin: SkinWithListings, listingId: string) => Promise<void>;
  isBusy: (key: string) => boolean;
}

const MySkinCard = ({
  skin,
  onLoad,
  onApply,
  onTogglePublish,
  onDelete,
  onCreateListing,
  onUpdateListing,
  onCancelListing,
  isBusy,
}: MySkinCardProps) => {
  const [listingPrice, setListingPrice] = useState<string>('');
  const [updateValues, setUpdateValues] = useState<Record<string, string>>({});

  const activeListings = useMemo(
    () => skin.listings.filter((listing) => listing.active && !listing.buyerId),
    [skin.listings],
  );

  const handleCreateListing = async () => {
    if (!listingPrice.trim()) return;
    await onCreateListing(skin, listingPrice);
    setListingPrice('');
  };

  const handleUpdateListing = async (listingId: string) => {
    const value = updateValues[listingId];
    if (!value || !value.trim()) return;
    await onUpdateListing(skin, listingId, value);
  };

  const busyCreate = isBusy(`listing-create-${skin.id}`);
  const busyPublish = isBusy(`skin-publish-${skin.id}`);
  const busyDelete = isBusy(`skin-delete-${skin.id}`);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-semibold">{skin.name}</CardTitle>
          <p className="text-xs text-white/60">ID: {skin.id}</p>
        </div>
        <Badge variant={skin.published ? 'default' : 'outline'}>
          {skin.published ? 'Opublikowany' : 'Szkic'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {skin.thumbnail ? (
          <div className="relative h-32 overflow-hidden rounded border border-white/10">
            <img src={skin.thumbnail} alt={skin.name} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onLoad(skin)}>
            Podglad
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await onApply(skin);
            }}
            disabled={isBusy(`skin-apply-${skin.id}`)}
          >
            Zastosuj
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onTogglePublish(skin, !skin.published)}
            disabled={busyPublish}
          >
            {busyPublish ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {skin.published ? 'Oznacz jako szkic' : 'Publikuj'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(skin)} disabled={busyDelete}>
            {busyDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Usun
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-white/60">Nowa oferta</p>
          <div className="flex gap-2">
            <Input
              value={listingPrice}
              onChange={(event) => setListingPrice(event.target.value)}
              placeholder="Cena w PLN"
              className="bg-white/10 border-white/10"
            />
            <Button size="sm" onClick={handleCreateListing} disabled={busyCreate || !listingPrice.trim()}>
              {busyCreate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Wystaw
            </Button>
          </div>
        </div>
        {activeListings.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-white/60">Aktywne oferty</p>
            {activeListings.map((listing) => {
              const updateBusy = isBusy(`listing-update-${listing.id}`);
              const cancelBusy = isBusy(`listing-cancel-${listing.id}`);
              return (
                <div key={listing.id} className="space-y-2 rounded border border-white/10 p-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{formatPrice(listing.price, listing.currency)}</span>
                    <span className="text-xs text-white/50">{new Date(listing.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={updateValues[listing.id] ?? ''}
                      onChange={(event) =>
                        setUpdateValues((prev) => ({ ...prev, [listing.id]: event.target.value }))
                      }
                      placeholder="Nowa cena"
                      className="bg-white/10 border-white/10"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateListing(listing.id)}
                      disabled={updateBusy || !(updateValues[listing.id] ?? '').trim()}
                    >
                      {updateBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Zmien cene
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCancelListing(skin, listing.id)}
                      disabled={cancelBusy}
                    >
                      {cancelBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Anuluj
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/50">Brak aktywnych ofert.</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-1 text-xs text-white/50">
        <span>Utworzono: {new Date(skin.createdAt).toLocaleString()}</span>
        <span>Aktualizacja: {new Date(skin.updatedAt).toLocaleString()}</span>
      </CardFooter>
    </Card>
  );
};

export default MySkinCard;
