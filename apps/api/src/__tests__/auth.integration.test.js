/**
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
  await request(app).post(`${BASE}/register`).send(body);
  const res = await request(app).post(`${BASE}/login`).send({
    email: body.email,
    password: body.password,
  });
  return res.body.data;
}

// ── Register ──────────────────────────────────────────────────────────────────
describe("POST /api/auth/register", () => {
  it("registers a new user and returns tokens + user", async () => {
    const res = await request(app).post(`${BASE}/register`).send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
    // Password must never be returned
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("rejects duplicate email with 409", async () => {
    await request(app).post(`${BASE}/register`).send(validUser);
    const res = await request(app).post(`${BASE}/register`).send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects missing name with 422", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ email: "a@b.com", password: "Password1!" });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("rejects weak password with 422", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ name: "Alice", email: "a@b.com", password: "weak" });

    expect(res.status).toBe(422);
  });

  it("rejects invalid email format with 422", async () => {
    const res = await request(app)
      .post(`${BASE}/register`)
      .send({ name: "Alice", email: "not-an-email", password: "Password1!" });

    expect(res.status).toBe(422);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post(`${BASE}/register`).send(validUser);
  });

  it("returns tokens and user on correct credentials", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
  });

  it("rejects wrong password with 401", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
      .send({ email: validUser.email, password: "WrongPass1!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects unknown email with 401 (no user enumeration)", async () => {
    const res = await request(app)
      .post(`${BASE}/login`)
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
      .post(`${BASE}/refresh`)
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
      .post(`${BASE}/refresh`)
      .send({ refreshToken: tokens.refreshToken });
    // Second use — should be rejected (token was already rotated)
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken: tokens.refreshToken });

    expect(res.status).toBe(401);
  });

  it("rejects a completely invalid token string with 401", async () => {
    const res = await request(app)
      .post(`${BASE}/refresh`)
      .send({ refreshToken: "not.a.real.token" });

    expect(res.status).toBe(401);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("revokes the refresh token (subsequent refresh returns 401)", async () => {
    const { tokens } = await registerAndLogin();

    await request(app)
      .post(`${BASE}/logout`)
      .send({ refreshToken: tokens.refreshToken });

    const res = await request(app)
      .post(`${BASE}/refresh`)
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
      .set("Authorization", `Bearer ${tokens.accessToken}`);

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
