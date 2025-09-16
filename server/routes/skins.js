import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createSkin, updateSkin, deleteSkin, getMySkins, getPublicSkins, createListing, updateListing, cancelListing, purchaseListing, getListings } from '../controllers/skinsController.js';

const router = express.Router();

router.post('/', requireAuth, asyncHandler(createSkin));
router.put('/:id', requireAuth, asyncHandler(updateSkin));
router.delete('/:id', requireAuth, asyncHandler(deleteSkin));
router.get('/user', requireAuth, asyncHandler(getMySkins));
router.get('/public', asyncHandler(getPublicSkins));
router.post('/:id/listings', requireAuth, asyncHandler(createListing));
router.patch('/:id/listings/:listingId', requireAuth, asyncHandler(updateListing));
router.delete('/:id/listings/:listingId', requireAuth, asyncHandler(cancelListing));
router.post('/:id/listings/:listingId/purchase', requireAuth, asyncHandler(purchaseListing));
router.get('/listings', asyncHandler(getListings));

export default router;
