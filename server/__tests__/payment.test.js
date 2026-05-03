import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

describe("payment mock flow", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("mock subscribe adds premium", async () => {
    const passwordHash = await bcrypt.hash("x", 10);
    await User.create({ email: "pay@test.com", passwordHash, roles: ["user"] });
    const login = await request(app).post("/api/auth/login").send({ email: "pay@test.com", password: "x" });
    const res = await request(app).post("/api/payment/mock-subscribe").set({ Authorization: `Bearer ${login.body.token}` });
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toContain("premium");
  });
});
