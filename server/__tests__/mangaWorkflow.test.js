import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Manga } from "../src/models/Manga.model.js";
import { Chapter } from "../src/models/Chapter.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

describe("manga draft → submit → admin", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Manga.deleteMany({}), Chapter.deleteMany({})]);
  });

  it("translator creates draft; submit moves to pending after chapter", async () => {
    const ph = await bcrypt.hash("p", 10);
    const tr = await User.create({ email: "tr@w.com", passwordHash: ph, roles: ["user", "translator"] });
    const login = await request(app).post("/api/auth/login").send({ email: "tr@w.com", password: "p" });
    const token = login.body.token;

    const create = await request(app).post("/api/manga").set({ Authorization: `Bearer ${token}` }).send({ title: "My draft" });
    expect(create.status).toBe(201);
    expect(create.body.manga.status).toBe("draft");
    const mid = create.body.manga._id;

    const subEarly = await request(app).post(`/api/manga/${mid}/submit-for-review`).set({ Authorization: `Bearer ${token}` });
    expect(subEarly.status).toBe(400);

    await Chapter.create({ mangaId: mid, number: 1, title: "Ch1", pages: [{ index: 0, imageUrl: "https://x/z.webp" }] });

    const sub = await request(app).post(`/api/manga/${mid}/submit-for-review`).set({ Authorization: `Bearer ${token}` });
    expect(sub.status).toBe(200);
    expect(sub.body.manga.status).toBe("pending");

    const mine = await request(app).get("/api/manga/my-work").set({ Authorization: `Bearer ${token}` });
    expect(mine.status).toBe(200);
    expect(mine.body.items.some((m) => String(m._id) === String(mid))).toBe(true);
  });
});
