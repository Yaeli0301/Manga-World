import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../src/app.js";
import { Manga } from "../src/models/Manga.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

describe("manga list & search", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await Manga.deleteMany({});
    await Manga.create([
      {
        title: "Alpha Demo",
        titleHe: "אלפא",
        description: "space adventure",
        genres: ["Sci-Fi", "Action"],
        status: "published",
        viewCount: 10,
        trendingScore: 1,
      },
      {
        title: "Beta Romance",
        descriptionHe: "רומנטיקה",
        genres: ["Romance"],
        status: "published",
        viewCount: 99,
        trendingScore: 5,
      },
      { title: "Draft X", genres: ["Action"], status: "draft" },
    ]);
  });

  it("finds by partial title without text index (regex)", async () => {
    const res = await request(app).get("/api/manga").query({ q: "alpha", status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].title).toMatch(/Alpha/i);
  });

  it("finds by Hebrew title field", async () => {
    const res = await request(app).get("/api/manga").query({ q: "אלפא", status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  it("filters by genre", async () => {
    const res = await request(app).get("/api/manga").query({ genres: "Romance", status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.items.every((m) => (m.genres || []).includes("Romance"))).toBe(true);
  });

  it("sorts by popular (viewCount)", async () => {
    const res = await request(app).get("/api/manga").query({ sort: "popular", status: "published", limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.items[0].title).toMatch(/Beta/i);
  });

  it("lists distinct genres", async () => {
    const res = await request(app).get("/api/manga/meta/genres");
    expect(res.status).toBe(200);
    expect(res.body.genres).toEqual(expect.arrayContaining(["Action", "Romance", "Sci-Fi"]));
  });
});
