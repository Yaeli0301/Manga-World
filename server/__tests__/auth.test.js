import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

describe("auth", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("registers and returns JWT", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "a@test.com", password: "longpassword1" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe("a@test.com");
  });

  it("logs in", async () => {
    await request(app).post("/api/auth/register").send({ email: "b@test.com", password: "longpassword1" });
    const res = await request(app).post("/api/auth/login").send({ email: "b@test.com", password: "longpassword1" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("refreshes access token", async () => {
    const reg = await request(app).post("/api/auth/register").send({ email: "c@test.com", password: "longpassword1" });
    const rt = reg.body.refreshToken;
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: rt });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.token).toBe(res.body.accessToken);
  });
});
