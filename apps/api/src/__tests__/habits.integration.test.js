/**
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
    name: `User ${seed}`,
    email: `user_${seed}@example.com`,
    password: "Password1!",
  };
  await request(app).post("/api/auth/register").send(user);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: user.password });
  return loginRes.body.data.tokens.accessToken;
}

function authed(token) {
  return (req) => req.set("Authorization", `Bearer ${token}`);
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
      request(app).delete(`/api/habits/${habitId}`),
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
      request(app).patch(`/api/habits/${id}`).send({ title: "Evening Run" }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Evening Run");
  });

  it("returns 404 for non-existent habit", async () => {
    const token = await createAuthedUser("i");
    const fakeId = "000000000000000000000001";
    const res = await authed(token)(
      request(app).patch(`/api/habits/${fakeId}`).send({ title: "X" }),
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
      request(app).delete(`/api/habits/${id}`),
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
        .post(`/api/habits/${id}/toggle`)
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
        .post(`/api/habits/${id}/toggle`)
        .send({ dateKey: today, completed: true }),
    );

    const res2 = await authed(token)(
      request(app)
        .post(`/api/habits/${id}/toggle`)
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
        .post(`/api/habits/${id}/toggle`)
        .send({ dateKey: today, completed: true }),
    );

    const res = await authed(token)(
      request(app)
        .post(`/api/habits/${id}/toggle`)
        .send({ dateKey: today, completed: false }),
    );

    expect(res.status).toBe(200);
    const completions = res.body.data.habit.completionHistory;
    const dayEntry = completions?.find((c) => c.dateKey === today);
    expect(dayEntry?.completed).toBeFalsy();
  });
});
