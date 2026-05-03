import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Manga } from "../src/models/Manga.model.js";
import { Chapter } from "../src/models/Chapter.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

async function authHeader() {
  const passwordHash = await bcrypt.hash("x", 10);
  const u = await User.create({ email: "p@test.com", passwordHash, roles: ["user"] });
  const login = await request(app).post("/api/auth/login").send({ email: "p@test.com", password: "x" });
  return { Authorization: `Bearer ${login.body.token}`, userId: u._id.toString() };
}

describe("reading progress", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Manga.deleteMany({}), Chapter.deleteMany({})]);
  });

  it("restores exact fields", async () => {
    const h = await authHeader();
    const m = await Manga.create({ title: "T", status: "published" });
    const c = await Chapter.create({ mangaId: m._id, number: 1, pages: [{ index: 0, imageUrl: "/x" }] });
    const put = await request(app)
      .put("/api/progress")
      .set(h)
      .send({
        mangaId: m._id.toString(),
        chapterId: c._id.toString(),
        pageIndex: 3,
        scrollPositionY: 1280,
        readingMode: "vertical",
      });
    expect(put.status).toBe(200);
    const get = await request(app).get(`/api/progress/manga/${m._id}`).set(h);
    expect(get.status).toBe(200);
    expect(get.body.progress.pageIndex).toBe(3);
    expect(get.body.progress.scrollPositionY).toBe(1280);
    expect(get.body.progress.readingMode).toBe("vertical");
  });

  it("stats count unique chapters opened", async () => {
    const h = await authHeader();
    const m = await Manga.create({ title: "T2", status: "published" });
    const c1 = await Chapter.create({ mangaId: m._id, number: 1, pages: [{ index: 0, imageUrl: "/a" }] });
    const c2 = await Chapter.create({ mangaId: m._id, number: 2, pages: [{ index: 0, imageUrl: "/b" }] });

    const s0 = await request(app).get("/api/progress/stats").set(h);
    expect(s0.status).toBe(200);
    expect(s0.body.uniqueChaptersOpened).toBe(0);

    await request(app).put("/api/progress").set(h).send({
      mangaId: m._id.toString(),
      chapterId: c1._id.toString(),
      pageIndex: 0,
      scrollPositionY: 0,
      readingMode: "vertical",
    });
    const s1 = await request(app).get("/api/progress/stats").set(h);
    expect(s1.body.uniqueChaptersOpened).toBe(1);
    expect(s1.body.seriesWithProgress).toBe(1);

    await request(app).put("/api/progress").set(h).send({
      mangaId: m._id.toString(),
      chapterId: c1._id.toString(),
      pageIndex: 1,
      scrollPositionY: 100,
      readingMode: "vertical",
    });
    const s2 = await request(app).get("/api/progress/stats").set(h);
    expect(s2.body.uniqueChaptersOpened).toBe(1);

    await request(app).put("/api/progress").set(h).send({
      mangaId: m._id.toString(),
      chapterId: c2._id.toString(),
      pageIndex: 0,
      scrollPositionY: 0,
      readingMode: "vertical",
    });
    const s3 = await request(app).get("/api/progress/stats").set(h);
    expect(s3.body.uniqueChaptersOpened).toBe(2);
    expect(s3.body.lastReadAt).toBeTruthy();
  });

  it("list progress includes manga cover and chapter number/title", async () => {
    const h = await authHeader();
    const m = await Manga.create({ title: "Listed", titleHe: "רשימה", coverUrl: "https://example.com/cover.webp", status: "published" });
    const c = await Chapter.create({ mangaId: m._id, number: 4, title: "Turn", titleHe: "פנייה", pages: [{ index: 0, imageUrl: "/z" }] });
    await request(app).put("/api/progress").set(h).send({
      mangaId: m._id.toString(),
      chapterId: c._id.toString(),
      pageIndex: 0,
      scrollPositionY: 0,
      readingMode: "vertical",
    });
    const list = await request(app).get("/api/progress").set(h);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
    const row = list.body.items[0];
    expect(row.mangaId.title).toBe("Listed");
    expect(row.mangaId.coverUrl).toContain("cover");
    expect(row.chapterId.number).toBe(4);
    expect(row.chapterId.title).toBe("Turn");
  });
});
