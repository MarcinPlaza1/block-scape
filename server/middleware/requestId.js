import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
  const headerName = 'x-request-id';
  const existing = req.get(headerName);
  const id = existing && typeof existing === 'string' && existing.length > 6 ? existing : randomUUID();
  req.id = id;
  res.setHeader(headerName, id);
  next();
}


