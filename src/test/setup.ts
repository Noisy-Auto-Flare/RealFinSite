import { beforeAll, afterAll } from "vitest";

// Tests will use an in-memory SQLite database
// Full test suite coming in Phase 0 completion

beforeAll(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.AUTH_SECRET = "test-secret-123456789012345678901234567890";
  process.env.MASTER_USERNAME = "testadmin";
  process.env.MASTER_PASSWORD = "testpass123";
});

afterAll(() => {
  // cleanup
});
