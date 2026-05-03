import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Manga } from "../src/models/Manga.model.js";
import { connectTestDb, disconnectTestDb } from "./helpers.js";

describe("admin bulk manga", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Manga.deleteMany({})]);
  });

  it("bulk publishes manga", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    await User.create({ email: "adm@test.com", passwordHash, roles: ["user", "admin"] });
    const login = await request(app).post("/api/auth/login").send({ email: "adm@test.com", password: "pw" });
    const token = login.body.token;
    const m1 = await Manga.create({ title: "A", status: "pending" });
    const m2 = await Manga.create({ title: "B", status: "pending" });
    const res = await request(app)
      .post("/api/admin/manga/bulk-status")
      .set({ Authorization: `Bearer ${token}` })
      .send({ ids: [m1._id.toString(), m2._id.toString()], status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.modified).toBe(2);
    const a = await Manga.findById(m1._id).lean();
    expect(a.status).toBe("published");
  });

  it("patches manga premium flag", async () => {
    const passwordHash = await bcrypt.hash("pw", 10);
    await User.create({ email: "adm2@test.com", passwordHash, roles: ["user", "admin"] });
    const login = await request(app).post("/api/auth/login").send({ email: "adm2@test.com", password: "pw" });
    const token = login.body.token;
    const m = await Manga.create({ title: "VIP", status: "published", isPremiumOnly: false });
    const res = await request(app)
      .patch(`/api/admin/manga/${m._id}`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ isPremiumOnly: true });
    expect(res.status).toBe(200);
    expect(res.body.manga.isPremiumOnly).toBe(true);
  });
});
