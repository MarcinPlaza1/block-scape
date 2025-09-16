-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_game_owner ON Game(ownerId);
CREATE INDEX IF NOT EXISTS idx_game_published ON Game(published);
CREATE INDEX IF NOT EXISTS idx_game_updatedAt ON Game(updatedAt);
-- Optional likes index
CREATE INDEX IF NOT EXISTS idx_like_game ON Like(gameId);
