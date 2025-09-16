import prisma from '../config/database.js';

const ACTIVE_LISTING_INCLUDE = { include: { skin: true } };

const validatePrice = (price) => {
	const numeric = typeof price === "string" ? Number(price) : price;
	if (!Number.isFinite(numeric) || numeric <= 0) {
		throw new Error("Invalid price");
	}
	return Math.floor(numeric);
};

export async function createSkin(req, res) {
	const { name, data, thumbnail, published } = req.body || {};
	if (!name || typeof data !== 'string') return res.status(400).json({ error: 'Invalid payload' });
	const skin = await prisma.skin.create({
		data: {
			name,
			data,
			thumbnail: typeof thumbnail === 'string' ? thumbnail : null,
			published: !!published,
			owner: { connect: { id: req.auth.userId } },
		},
	});
	return res.status(201).json({ skin });
}

export async function updateSkin(req, res) {
	const { id } = req.params;
	const payload = req.body || {};
	const skin = await prisma.skin.findFirst({ where: { id, ownerId: req.auth.userId } });
	if (!skin) return res.status(404).json({ error: 'Not found' });
	const data = {};
	if (typeof payload.name === 'string') data.name = payload.name;
	if (typeof payload.data === 'string') data.data = payload.data;
	if (typeof payload.thumbnail === 'string') data.thumbnail = payload.thumbnail;
	if (typeof payload.published === 'boolean') data.published = payload.published;
	const upd = await prisma.skin.update({ where: { id }, data });
	return res.json({ skin: upd });
}

export async function deleteSkin(req, res) {
	const { id } = req.params;
	const skin = await prisma.skin.findFirst({ where: { id, ownerId: req.auth.userId } });
	if (!skin) return res.status(404).json({ error: 'Not found' });
	await prisma.$transaction([
		prisma.skinListing.updateMany({ where: { skinId: id, active: true }, data: { active: false } }),
		prisma.skin.delete({ where: { id } }),
	]);
	return res.json({ ok: true });
}

export async function getMySkins(req, res) {
	const skins = await prisma.skin.findMany({
		where: { ownerId: req.auth.userId },
		orderBy: { updatedAt: 'desc' },
		include: { listings: true },
	});
	return res.json({ skins });
}

export async function getPublicSkins(_req, res) {
	const skins = await prisma.skin.findMany({ where: { published: true }, orderBy: { updatedAt: 'desc' } });
	return res.json({ skins });
}

export async function createListing(req, res) {
	const { id } = req.params;
	const { price, currency } = req.body || {};
	const skin = await prisma.skin.findFirst({ where: { id, ownerId: req.auth.userId } });
	if (!skin) return res.status(404).json({ error: 'Not found' });
	let normalizedPrice;
	try {
		normalizedPrice = validatePrice(price);
	} catch (e) {
		return res.status(400).json({ error: e.message });
	}
	const listing = await prisma.skinListing.create({
		data: {
			skin: { connect: { id } },
			price: normalizedPrice,
			currency: typeof currency === 'string' ? currency : 'PLN',
			active: true,
		},
	});
	return res.status(201).json({ listing });
}

export async function updateListing(req, res) {
	const { id, listingId } = req.params;
	const { price, currency } = req.body || {};
	const listing = await prisma.skinListing.findFirst({
		where: { id: listingId, skinId: id },
		include: { skin: true },
	});
	if (!listing || listing.skin.ownerId !== req.auth.userId) return res.status(404).json({ error: 'Not found' });
	const data = {};
	if (price !== undefined) {
		try {
			data.price = validatePrice(price);
		} catch (e) {
			return res.status(400).json({ error: e.message });
		}
	}
	if (currency) data.currency = currency;
	const updated = await prisma.skinListing.update({ where: { id: listingId }, data, ...ACTIVE_LISTING_INCLUDE });
	return res.json({ listing: updated });
}

export async function cancelListing(req, res) {
	const { id, listingId } = req.params;
	const listing = await prisma.skinListing.findFirst({
		where: { id: listingId, skinId: id, active: true },
		include: { skin: true },
	});
	if (!listing || listing.skin.ownerId !== req.auth.userId) return res.status(404).json({ error: 'Not found' });
	const updated = await prisma.skinListing.update({ where: { id: listingId }, data: { active: false }, ...ACTIVE_LISTING_INCLUDE });
	return res.json({ listing: updated });
}

export async function purchaseListing(req, res) {
	const { id, listingId } = req.params;
	const listing = await prisma.skinListing.findFirst({
		where: { id: listingId, skinId: id, active: true },
		include: { skin: true },
	});
	if (!listing) return res.status(404).json({ error: 'Not found' });
	if (listing.skin.ownerId === req.auth.userId) return res.status(400).json({ error: 'Cannot purchase own skin' });
	const buyerId = req.auth.userId;
	const [updatedListing, updatedSkin] = await prisma.$transaction([
		prisma.skinListing.update({
			where: { id: listingId },
			data: { active: false, buyerId, soldAt: new Date() },
			...ACTIVE_LISTING_INCLUDE,
		}),
		prisma.skin.update({ where: { id }, data: { ownerId: buyerId } }),
	]);
	return res.json({ listing: updatedListing, skin: updatedSkin });
}

export async function getListings(_req, res) {
	const listings = await prisma.skinListing.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, include: { skin: true } });
	return res.json({ listings });
}

