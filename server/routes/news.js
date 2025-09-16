import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parsePagination } from '../utils/helpers.js';
import config from '../config/config.js';

const router = Router();

// Get news list
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query, {
    limit: config.pagination.defaultNewsLimit
  });
  
  const items = config.news.slice(offset, offset + limit);
  
  res.json({ 
    news: items, 
    total: config.news.length, 
    page, 
    limit 
  });
}));

// Get single news item
router.get('/:id', asyncHandler(async (req, res) => {
  const found = config.news.find(n => n.id === req.params.id);
  
  if (!found) {
    return res.status(404).json({ error: 'News not found' });
  }
  
  res.json({ news: found });
}));

export default router;
