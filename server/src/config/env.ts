import path from 'path';
import dotenv from 'dotenv';

// Loads server/.env. Import this module first so the variables are in place
// before anything else reads process.env. Existing variables are not overridden.
dotenv.config({ path: path.join(__dirname, '../../.env') });
