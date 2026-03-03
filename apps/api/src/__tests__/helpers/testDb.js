/**
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
