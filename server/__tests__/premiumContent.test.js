import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Manga } from "../src/models/Manga.model.js";
import { Chapter } from "../src/models/Chapter.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

describe("premium-only manga and chapters", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await User.deleteMany({});
    await Manga.deleteMany({});
    await Chapter.deleteMany({});
  });

  it("locks chapter when manga is premium-only for non-premium user", async () => {
    const passwordHash = await bcrypt.hash("p", 10);
    await User.create({ email: "reader@test.com", passwordHash, roles: ["user"] });
    const m = await Manga.create({ title: "Premium series", status: "published", isPremiumOnly: true });
    const ch = await Chapter.create({
      mangaId: m._id,
      number: 1,
      title: "Ch1",
      pages: [
        { index: 0, imageUrl: "https://example.com/0.webp" },
        { index: 1, imageUrl: "https://example.com/1.webp" },
      ],
    });

    const login = await request(app).post("/api/auth/login").send({ email: "reader@test.com", password: "p" });
    expect(login.status).toBe(200);
    const res = await request(app).get(`/api/chapters/${ch._id}`).set({ Authorization: `Bearer ${login.body.token}` });
    expect(res.status).toBe(200);
    expect(res.body.chapter.locked).toBe(true);
    expect((res.body.chapter.pages || []).length).toBeLessThanOrEqual(2);

    await User.updateOne({ email: "reader@test.com" }, { $set: { roles: ["user", "premium"] } });
    const login2 = await request(app).post("/api/auth/login").send({ email: "reader@test.com", password: "p" });
    const res2 = await request(app).get(`/api/chapters/${ch._id}`).set({ Authorization: `Bearer ${login2.body.token}` });
    expect(res2.body.chapter.locked).toBe(false);
    expect(res2.body.chapter.pages.length).toBe(2);
  });

  it("locks chapter when chapter is premium-only for non-premium user", async () => {
    const passwordHash = await bcrypt.hash("p", 10);
    await User.create({ email: "u2@test.com", passwordHash, roles: ["user"] });
    const m = await Manga.create({ title: "Free series", status: "published", isPremiumOnly: false });
    const ch = await Chapter.create({
      mangaId: m._id,
      number: 1,
      title: "VIP",
      isPremiumOnly: true,
      pages: [
        { index: 0, imageUrl: "https://example.com/a.webp" },
        { index: 1, imageUrl: "https://example.com/b.webp" },
        { index: 2, imageUrl: "https://example.com/c.webp" },
      ],
    });
    const login = await request(app).post("/api/auth/login").send({ email: "u2@test.com", password: "p" });
    const res = await request(app).get(`/api/chapters/${ch._id}`).set({ Authorization: `Bearer ${login.body.token}` });
    expect(res.body.chapter.locked).toBe(true);
  });
});
