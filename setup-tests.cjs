/**
 * setup-tests.cjs
 * Run: node setup-tests.cjs
 *
 * Creates the full integration test directory structure and all test files.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const API_SRC = path.join(__dirname, "apps", "api", "src");
const TESTS_DIR = path.join(API_SRC, "__tests__");
const HELPERS_DIR = path.join(TESTS_DIR, "helpers");

// ── Create directories ──────────────────────────────────────────────────────
[TESTS_DIR, HELPERS_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));
console.log("✓ Created test directories");

// ── File contents ────────────────────────────────────────────────────────────

const TESTDB_JS = `/**
 * Test helpers — shared setup for all integration tests.
 *
 * MongoMemoryServer spins up a real mongod in-process.
 * Each test file gets an isolated in-memory database that is
 * wiped between tests via clearDB() and fully torn down in afterAll().
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod;

/** Start a fresh in-memory MongoDB instance. Call in beforeAll(). */
export async function connectTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

/** Wipe all collections. Call in beforeEach() to isolate tests. */
export async function clearDB() {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
}

/** Disconnect and stop the memory server. Call in afterAll(). */
export async function closeTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}
`;

const AUTH_TEST_JS = `/**
 * Auth API — Integration Tests
 *
 * Covers: register, login, token refresh, logout, protected route access.
 * Uses MongoMemoryServer so no external DB is needed.
 */

import request from "supertest";
import app from "../../app.js";
import { connectTestDB, clearDB, closeTestDB } from "./helpers/testDb.js";

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Stub env vars that dotenv would normally load from .env
  process.env.JWT_SECRET = "test-jwt-secret-at-least-16-chars";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-16chars";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  await connectTestDB();
});

beforeEach(clearDB);
afterAll(closeTestDB);

// ── Helpers ───────────────────────────────────────────────────────────────────
const BASE = "/api/auth";
const validUser = {
  name: "Test User",
  email: "test@example.com",
  password: "Password1!",
};

async function registerAndLogin(overrides = {}) {
  const body = { ...validUser, ...overrides };
  await request(app).post(\`\${BASE}/register\`).send(body);
  const res = await request(app).post(\`\${BASE}/login\`).send({
    email: body.email,
    password: body.password,
  });
  return res.body.data;
}

// ── Register ──────────────────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("registers a new user and returns tokens + user", async () => {
    const res = await request(app).post(\`\${BASE}/register\`).send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
    // Password must never be returned
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("rejects duplicate email with 409", async () => {
    await request(app).post(\`\${BASE}/register\`).send(validUser);
    const res = await request(app).post(\`\${BASE}/register\`).send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects missing name with 422", async () => {
    const res = await request(app)
      .post(\`\${BASE}/register\`)
      .send({ email: "a@b.com", password: "Password1!" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("rejects weak password with 422", async () => {
    const res = await request(app)
      .post(\`\${BASE}/register\`)
      .send({ name: "Alice", email: "a@b.com", password: "weak" });

    expect(res.status).toBe(422);
  });

  it("rejects invalid email format with 422", async () => {
    const res = await request(app)
      .post(\`\${BASE}/register\`)
      .send({ name: "Alice", email: "not-an-email", password: "Password1!" });

    expect(res.status).toBe(422);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post(\`\${BASE}/register\`).send(validUser);
  });

  it("returns tokens and user on correct credentials", async () => {
    const res = await request(app)
      .post(\`\${BASE}/login\`)
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it("rejects wrong password with 401", async () => {
    const res = await request(app)
      .post(\`\${BASE}/login\`)
      .send({ email: validUser.email, password: "WrongPass1!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects unknown email with 401 (no user enumeration)", async () => {
    const res = await request(app)
      .post(\`\${BASE}/login\`)
      .send({ email: "nobody@example.com", password: "Password1!" });

    expect(res.status).toBe(401);
    // Must use the same message as wrong-password to prevent user enumeration
    expect(res.body.message).toMatch(/invalid email or password/i);
  });
});

// ── Token refresh ─────────────────────────────────────────────────────────────
describe("POST /api/auth/refresh", () => {
  it("returns a new token pair given a valid refresh token", async () => {
    const { tokens } = await registerAndLogin();
    const res = await request(app)
      .post(\`\${BASE}/refresh\`)
      .send({ refreshToken: tokens.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // Rotated refresh token must differ from the original
    expect(res.body.data.refreshToken).not.toBe(tokens.refreshToken);
  });

  it("rejects a reused refresh token with 401 (rotation / theft detection)", async () => {
    const { tokens } = await registerAndLogin();
    // First use — legitimate
    await request(app)
      .post(\`\${BASE}/refresh\`)
      .send({ refreshToken: tokens.refreshToken });
    // Second use — should be rejected (token was already rotated)
    const res = await request(app)
      .post(\`\${BASE}/refresh\`)
      .send({ refreshToken: tokens.refreshToken });

    expect(res.status).toBe(401);
  });

  it("rejects a completely invalid token string with 401", async () => {
    const res = await request(app)
      .post(\`\${BASE}/refresh\`)
      .send({ refreshToken: "not.a.real.token" });

    expect(res.status).toBe(401);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("revokes the refresh token (subsequent refresh returns 401)", async () => {
    const { tokens } = await registerAndLogin();

    await request(app)
      .post(\`\${BASE}/logout\`)
      .send({ refreshToken: tokens.refreshToken });

    const res = await request(app)
      .post(\`\${BASE}/refresh\`)
      .send({ refreshToken: tokens.refreshToken });

    expect(res.status).toBe(401);
  });
});

// ── Protected route ───────────────────────────────────────────────────────────
describe("Protected route access", () => {
  it("allows access with a valid Bearer token", async () => {
    const { tokens } = await registerAndLogin();
    const res = await request(app)
      .get("/api/habits")
      .set("Authorization", \`Bearer \${tokens.accessToken}\`);

    expect(res.status).toBe(200);
  });

  it("rejects requests with no token with 401", async () => {
    const res = await request(app).get("/api/habits");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a malformed token with 401", async () => {
    const res = await request(app)
      .get("/api/habits")
      .set("Authorization", "Bearer bad.token.here");
    expect(res.status).toBe(401);
  });
});
`;

const HABITS_TEST_JS = `/**
 * Habits API — Integration Tests
 *
 * Covers: CRUD operations, completion toggle, gamification XP response.
 */

import request from "supertest";
import app from "../../app.js";
import { connectTestDB, clearDB, closeTestDB } from "./helpers/testDb.js";

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret-at-least-16-chars";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-16chars";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_EXPIRES_IN = "7d";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  await connectTestDB();
});

beforeEach(clearDB);
afterAll(closeTestDB);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function createAuthedUser(seed = "a") {
  const user = {
    name: \`User \${seed}\`,
    email: \`user_\${seed}@example.com\`,
    password: "Password1!",
  };
  await request(app).post("/api/auth/register").send(user);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: user.password });
  return loginRes.body.data.tokens.accessToken;
}

function authed(token) {
  return (req) => req.set("Authorization", \`Bearer \${token}\`);
}

const habitPayload = {
  title: "Morning Run",
  description: "Run 5km every morning",
  category: "health",
  frequency: "daily",
  targetDays: [],
  difficulty: "medium",
};

// ── Create ────────────────────────────────────────────────────────────────────
describe("POST /api/habits", () => {
  it("creates a habit and returns it", async () => {
    const token = await createAuthedUser();
    const res = await authed(token)(
      request(app).post("/api/habits").send(habitPayload),
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(habitPayload.title);
    expect(res.body.data.streakCount).toBe(0);
  });

  it("rejects missing title with 422", async () => {
    const token = await createAuthedUser("b");
    const res = await authed(token)(
      request(app)
        .post("/api/habits")
        .send({ ...habitPayload, title: undefined }),
    );
    expect(res.status).toBe(422);
  });

  it("cannot access another user's habits", async () => {
    const tokenA = await createAuthedUser("c");
    const tokenB = await createAuthedUser("d");

    // User A creates a habit
    const createRes = await authed(tokenA)(
      request(app).post("/api/habits").send(habitPayload),
    );
    const habitId = createRes.body.data._id;

    // User B tries to delete it
    const delRes = await authed(tokenB)(
      request(app).delete(\`/api/habits/\${habitId}\`),
    );
    expect(delRes.status).toBe(404);
  });
});

// ── List ──────────────────────────────────────────────────────────────────────
describe("GET /api/habits", () => {
  it("returns an empty array when user has no habits", async () => {
    const token = await createAuthedUser("e");
    const res = await authed(token)(request(app).get("/api/habits"));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("returns only the authenticated user's habits", async () => {
    const tokenA = await createAuthedUser("f");
    const tokenB = await createAuthedUser("g");

    await authed(tokenA)(request(app).post("/api/habits").send(habitPayload));
    await authed(tokenA)(
      request(app)
        .post("/api/habits")
        .send({ ...habitPayload, title: "Habit 2" }),
    );

    const resA = await authed(tokenA)(request(app).get("/api/habits"));
    const resB = await authed(tokenB)(request(app).get("/api/habits"));

    expect(resA.body.data).toHaveLength(2);
    expect(resB.body.data).toHaveLength(0);
  });
});

// ── Update ────────────────────────────────────────────────────────────────────
describe("PATCH /api/habits/:id", () => {
  it("updates title and returns updated habit", async () => {
    const token = await createAuthedUser("h");
    const create = await authed(token)(
      request(app).post("/api/habits").send(habitPayload),
    );
    const id = create.body.data._id;

    const res = await authed(token)(
      request(app).patch(\`/api/habits/\${id}\`).send({ title: "Evening Run" }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Evening Run");
  });

  it("returns 404 for non-existent habit", async () => {
    const token = await createAuthedUser("i");
    const fakeId = "000000000000000000000001";
    const res = await authed(token)(
      request(app).patch(\`/api/habits/\${fakeId}\`).send({ title: "X" }),
    );
    expect(res.status).toBe(404);
  });
});

// ── Delete ────────────────────────────────────────────────────────────────────
describe("DELETE /api/habits/:id", () => {
  it("deletes a habit and removes it from the list", async () => {
    const token = await createAuthedUser("j");
    const create = await authed(token)(
      request(app).post("/api/habits").send(habitPayload),
    );
    const id = create.body.data._id;

    const del = await authed(token)(
      request(app).delete(\`/api/habits/\${id}\`),
    );
    expect(del.status).toBe(200);

    const list = await authed(token)(request(app).get("/api/habits"));
    expect(list.body.data).toHaveLength(0);
  });
});

// ── Toggle completion ─────────────────────────────────────────────────────────
describe("POST /api/habits/:id/toggle", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("marks a habit complete and returns xpEarned", async () => {
    const token = await createAuthedUser("k");
    const create = await authed(token)(
      request(app).post("/api/habits").send(habitPayload),
    );
    const id = create.body.data._id;

    const res = await authed(token)(
      request(app)
        .post(\`/api/habits/\${id}/toggle\`)
        .send({ dateKey: today, completed: true }),
    );

    expect(res.status).toBe(200);
    expect(typeof res.body.data.xpEarned).toBe("number");
    expect(res.body.data.xpEarned).toBeGreaterThanOrEqual(0);
    expect(res.body.data.habit).toBeDefined();
  });

  it("is idempotent — toggling twice on same day earns XP only once", async () => {
    const token = await createAuthedUser("l");
    const create = await authed(token)(
      request(app).post("/api/habits").send(habitPayload),
    );
    const id = create.body.data._id;

    await authed(token)(
      request(app)
        .post(\`/api/habits/\${id}/toggle\`)
        .send({ dateKey: today, completed: true }),
    );

    const res2 = await authed(token)(
      request(app)
        .post(\`/api/habits/\${id}/toggle\`)
        .send({ dateKey: today, completed: true }),
    );

    // Second toggle same day — xpEarned should be 0 (already credited)
    expect(res2.body.data.xpEarned).toBe(0);
  });

  it("removes completion when toggled off", async () => {
    const token = await createAuthedUser("m");
    const create = await authed(token)(
      request(app).post("/api/habits").send(habitPayload),
    );
    const id = create.body.data._id;

    await authed(token)(
      request(app)
        .post(\`/api/habits/\${id}/toggle\`)
        .send({ dateKey: today, completed: true }),
    );

    const res = await authed(token)(
      request(app)
        .post(\`/api/habits/\${id}/toggle\`)
        .send({ dateKey: today, completed: false }),
    );

    expect(res.status).toBe(200);
    const completions = res.body.data.habit.completionHistory;
    const dayEntry = completions?.find((c) => c.dateKey === today);
    expect(dayEntry?.completed).toBeFalsy();
  });
});
`;

// ── Write files ──────────────────────────────────────────────────────────────
const files = {
  [path.join(HELPERS_DIR, "testDb.js")]: TESTDB_JS,
  [path.join(TESTS_DIR, "auth.integration.test.js")]: AUTH_TEST_JS,
  [path.join(TESTS_DIR, "habits.integration.test.js")]: HABITS_TEST_JS,
};

for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(filePath, content, "utf8");
  console.log("✓ Written", path.relative(__dirname, filePath));
}

console.log("\n✅ Test infrastructure ready.");
console.log("\nNext steps:");
console.log("  1. cd apps/api && npm install");
console.log("  2. npm run test:unit       (streak engine tests)");
console.log("  3. npm run test:integration  (API integration tests)");
