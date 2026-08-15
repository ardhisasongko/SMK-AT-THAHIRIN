UPDATE users
SET must_change_password = 1
WHERE password_hash = 'pbkdf2$100000$09f1587b180fa82cbe53efd41ab89d11$4cce0df0304be6c6a29761ff00280b568882e56b320017d0223fc8e4b44604ea';

DELETE FROM sessions WHERE expires_at < datetime('now');

CREATE INDEX IF NOT EXISTS idx_photos_user_created ON photos(created_by, created_at DESC);
