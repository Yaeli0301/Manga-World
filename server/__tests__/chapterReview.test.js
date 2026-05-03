import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Manga } from "../src/models/Manga.model.js";
import { Chapter } from "../src/models/Chapter.model.js";
import { ChapterReview } from "../src/models/ChapterReview.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

async function authUser() {
  const passwordHash = await bcrypt.hash("x", 10);
  const u = await User.create({ email: "cr@test.com", passwordHash, roles: ["user"] });
  const login = await request(app).post("/api/auth/login").send({ email: "cr@test.com", password: "x" });
  return { Authorization: `Bearer ${login.body.token}`, userId: u._id };
}

describe("chapter reviews", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await Promise.all([User.deleteMany({ email: /cr@test/ }), Manga.deleteMany({}), Chapter.deleteMany({}), ChapterReview.deleteMany({})]);
  });

  it("creates and lists chapter reaction", async () => {
    const h = await authUser();
    const m = await Manga.create({ title: "M", status: "published" });
    const ch = await Chapter.create({ mangaId: m._id, number: 1, pages: [{ index: 0, imageUrl: "/a" }] });

    const put = await request(app)
      .put(`/api/chapters/${ch._id}/reviews/me`)
      .set(h)
      .send({ stars: 5, comment: "Great", emoji: "🔥" });
    expect(put.status).toBe(200);

    const list = await request(app).get(`/api/chapters/${ch._id}/reviews`).set(h);
    expect(list.status).toBe(200);
    expect(list.body.stats.reviewCount).toBe(1);
    expect(list.body.stats.avgStars).toBe(5);
    expect(list.body.recent[0].comment).toBe("Great");
    expect(list.body.mine.stars).toBe(5);
  });
});
