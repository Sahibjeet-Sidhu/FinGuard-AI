import './config/env';
import app from './app';
import { initializeSchema } from './database/schema';

const PLACEHOLDER_SECRET = 'your_strong_random_secret_here';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env and set a secret.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === PLACEHOLDER_SECRET) {
  console.error('JWT_SECRET is still the placeholder from .env.example. Set a strong random secret.');
  process.exit(1);
}

initializeSchema();

const PORT = Number(process.env.PORT) || 3001;
// Listen on the loopback interface only, so the API (and its demo accounts)
// is not reachable from other devices on the same network.
const HOST = process.env.HOST || 'localhost';
app.listen(PORT, HOST, () => {
  console.log(`FinGuard AI server running on http://${HOST}:${PORT}`);
});
