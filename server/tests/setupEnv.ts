// Runs before each test file. Tests use their own secret and a private
// in-memory database, so they never depend on server/.env or touch dev data.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'jest-only-signing-secret';
process.env.JWT_EXPIRES_IN = '1h';
