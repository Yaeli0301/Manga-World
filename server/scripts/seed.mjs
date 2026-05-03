import "dotenv/config";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { connectMongo, disconnectMongo } from "../src/db/mongo.js";
import { User } from "../src/models/User.model.js";
import { Manga } from "../src/models/Manga.model.js";
import { Chapter } from "../src/models/Chapter.model.js";
import { ReadingProgress } from "../src/models/ReadingProgress.model.js";
import { Subscription } from "../src/models/Subscription.model.js";
import { uploadBufferToStorage } from "../src/services/upload.service.js";

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Readable “comic page” as WebP from SVG (works without fonts on server). */
async function demoPagePng({ headline, lines, c1, c2, w = 720, h = 1120 }) {
  const ly = lines.slice(0, 5).map((t, i) => {
    const y = 380 + i * 52;
    const size = i === 0 ? 34 : 28;
    return `<text x="50%" y="${y}" text-anchor="middle" fill="rgba(255,255,255,0.94)" font-size="${size}" font-family="Segoe UI, system-ui, sans-serif">${escXml(t)}</text>`;
  });
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="40" y="40" width="${w - 80}" height="${h - 80}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="5" rx="16"/>
  <text x="50%" y="220" text-anchor="middle" fill="#ffffff" font-size="46" font-weight="700" font-family="Segoe UI, system-ui, sans-serif">${escXml(headline)}</text>
  ${ly.join("")}
  <text x="50%" y="${h - 80}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="18" font-family="Segoe UI, system-ui, sans-serif">Demo page · AI Manga Reader</text>
</svg>`;
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
  return buf;
}

async function uploadPage(buffer, mangaId, chNum, idx) {
  return uploadBufferToStorage(buffer, {
    folder: `demo/${mangaId}/ch${chNum}`,
    publicId: `page_${idx}`,
  });
}

async function createChapter({ mangaId, number, title, titleHe, pagesMeta, colors, premium }) {
  const pages = [];
  let i = 0;
  for (const meta of pagesMeta) {
    const raw = await demoPagePng({
      headline: meta.headline,
      lines: meta.lines,
      c1: colors.c1,
      c2: colors.c2,
    });
    const { url } = await uploadPage(raw, mangaId, number, i);
    const im = sharp(raw);
    const m = await im.metadata();
    const rawHe = await demoPagePng({
      headline: meta.headlineHe || `${meta.headline} · עברית`,
      lines: meta.linesHe ?? [`דף ${i + 1}`, ...(meta.lines || []).slice(0, 3)],
      c1: colors.c2,
      c2: colors.c1,
    });
    const { url: urlHe } = await uploadPage(rawHe, mangaId, number, `${i}_he`);
    pages.push({ index: i, imageUrl: url, imageUrlHe: urlHe, width: m.width, height: m.height });
    i += 1;
  }
  return Chapter.create({
    mangaId,
    number,
    title,
    titleHe: titleHe || "",
    pages,
    isPremiumOnly: Boolean(premium),
    translationStatus: titleHe ? "published" : "none",
  });
}

async function main() {
  await connectMongo();

  const seedUserFilter = { $or: [{ email: /@seed\.local$/ }, { email: /@manga\.local$/ }] };
  const existing = await User.find(seedUserFilter).select("_id").lean();
  const uids = existing.map((u) => u._id);
  if (uids.length) {
    await ReadingProgress.deleteMany({ userId: { $in: uids } });
    await Subscription.deleteMany({ userId: { $in: uids } });
    await User.deleteMany(seedUserFilter);
  }

  const demoMangas = await Manga.find({ title: /^Demo: / }).select("_id").lean();
  const mids = demoMangas.map((m) => m._id);
  if (mids.length) {
    await Chapter.deleteMany({ mangaId: { $in: mids } });
    await Manga.deleteMany({ _id: { $in: mids } });
  }

  const passwordHash = await bcrypt.hash("SeedPass123!", 10);
  const demoSimpleHash = await bcrypt.hash("DemoRead2026!", 10);

  const admin = await User.create({
    email: "admin@seed.local",
    passwordHash,
    displayName: "מנהל דמו",
    roles: ["user", "premium", "translator", "admin"],
    language: "he",
  });
  const reader = await User.create({
    email: "reader@seed.local",
    passwordHash,
    displayName: "קורא דמו",
    roles: ["user"],
    language: "he",
  });
  /** משתמש דמה ייעודי להתחברות מהירה (מומלץ לבדיקות) */
  const demoUser = await User.create({
    email: "demo@manga.local",
    passwordHash: demoSimpleHash,
    displayName: "משתמש דמה",
    roles: ["user"],
    language: "he",
  });

  const palette = {
    a: { c1: "#1e3a5f", c2: "#0f172a" },
    b: { c1: "#4c1d95", c2: "#1e1b4b" },
    c: { c1: "#0f766e", c2: "#134e4a" },
    d: { c1: "#9a3412", c2: "#431407" },
  };

  const series = [
    {
      title: "Demo: Midnight Ramen Blues",
      titleHe: "דמו: ראמן חצות בלוז",
      description:
        "Slice-of-life comedy about a tiny night stall and big feelings. Tap any chapter — scroll works, progress saves.",
      descriptionHe: "קומדיה יומיומית על דוכן לילה קטן ורגשות גדולים. גלילה ושמירת התקדמות עובדות.",
      genres: ["comedy", "slice of life"],
      trendingScore: 120,
      chapters: [
        {
          n: 1,
          title: "First bowl",
          titleHe: "קערה ראשונה",
          premium: false,
          pages: [
            { headline: "Chapter 1", lines: ["The city hums low.", "A neon sign flickers: OPEN.", "You pull up a stool.", "This is where the story starts."] },
            { headline: "Steam rises", lines: ["Broth simmers.", "The cook grins.", "No menu — just trust.", "Turn the page."] },
            { headline: "Regular?", lines: ["“Same as always?”", "You nod.", "Warm bowl slides over.", "Comfort in ceramic."] },
            { headline: "Small talk", lines: ["Rain taps the roof.", "Someone laughs two seats down.", "Night feels shorter here."] },
          ],
        },
        {
          n: 2,
          title: "Second shift",
          titleHe: "משמרת שנייה",
          premium: false,
          pages: [
            { headline: "Later", lines: ["Crowd thins.", "The radio plays soft jazz.", "A notebook appears.", "Recipes and dreams."] },
            { headline: "Closing time", lines: ["Lights dim slowly.", "“See you tomorrow.”", "Street air hits cool.", "Continue reading anytime."] },
          ],
        },
      ],
      colors: palette.a,
    },
    {
      title: "Demo: Chrome Ronin",
      titleHe: "דמו: רונין כרום",
      description: "Sci-fi action demo. Chapter 3 is premium-only — tests paywall + locked preview.",
      descriptionHe: "מדע בדיוני. פרק 3 לפרימיום — בודק חומה ותצוגה מטושטשת.",
      genres: ["action", "sci-fi"],
      trendingScore: 95,
      chapters: [
        {
          n: 1,
          title: "Wake signal",
          titleHe: "אות התעוררות",
          premium: false,
          pages: [
            { headline: "Signal", lines: ["Static cracks the HUD.", "Coordinates blink red.", "You were retired.", "Not anymore."] },
            { headline: "Rooftop run", lines: ["Mag boots grip steel.", "Drones sweep searchlights.", "One jump to the rail.", "Keep scrolling."] },
            { headline: "Edge city", lines: ["Below: endless sprawl.", "Above: quiet stars.", "Between: you.", "End of chapter."] },
          ],
        },
        {
          n: 2,
          title: "Ghost market",
          titleHe: "שוק הרוחות",
          premium: false,
          pages: [
            { headline: "Alley deal", lines: ["Vendor: “No refunds.”", "Chip slides across palm.", "Cold metal taste.", "Trust is expensive."] },
            { headline: "Chase", lines: ["Footsteps echo triple.", "You cut through steam.", "Exit sign glows green.", "Breathe."] },
          ],
        },
        {
          n: 3,
          title: "Vault key (Premium)",
          titleHe: "מפתח הכספת (פרימיום)",
          premium: true,
          pages: [
            { headline: "Premium arc", lines: ["This chapter is locked", "for free accounts.", "Use mock premium in Profile", "or Stripe checkout."] },
            { headline: "Inside", lines: ["Blueprints unfurl.", "AI whispers coordinates.", "The city waits.", "To be continued…"] },
          ],
        },
      ],
      colors: palette.b,
    },
    {
      title: "Demo: Paper Hearts Academy",
      titleHe: "דמו: אקדמיה ללבבות נייר",
      description: "School romance demo — gentle pacing for vertical reader tests.",
      descriptionHe: "רומן בתי ספר — קצב נוח לבדיקת קורא אנכי.",
      genres: ["romance", "school"],
      trendingScore: 88,
      chapters: [
        {
          n: 1,
          title: "Transfer day",
          titleHe: "יום העברה",
          premium: false,
          pages: [
            { headline: "New desk", lines: ["Chalk dust in sunbeams.", "Whispers follow you.", "Name tag: still blank.", "Smile anyway."] },
            { headline: "Hallway", lines: ["Lockers slam rhythm.", "Someone waves shyly.", "You wave back.", "Pages feel lighter."] },
            { headline: "Roof", lines: ["Bell rings distant.", "Wind lifts paper.", "A secret starts small.", "Scroll on."] },
          ],
        },
      ],
      colors: palette.c,
    },
    {
      title: "Demo: Ink & Thunder",
      titleHe: "דמו: דיו ורעם",
      description: "Superhero pastiche — bold spreads, good for paging mode.",
      descriptionHe: "פארודיה על גיבורי על — מתאים למצב עמודים.",
      genres: ["superhero", "action"],
      trendingScore: 102,
      chapters: [
        {
          n: 1,
          title: "Origin noise",
          titleHe: "רעש המקור",
          premium: false,
          pages: [
            { headline: "BOOM", lines: ["Not a metaphor.", "Glass sings.", "You stand.", "Costume: TBD."] },
            { headline: "Crowd", lines: ["Phones rise like torches.", "Sirens stitch the block.", "You breathe once.", "Move."] },
            { headline: "Alley choice", lines: ["Left: safety.", "Right: truth.", "Forward: you.", "Pick a mode in reader."] },
            { headline: "Quiet beat", lines: ["Heart slows.", "Rain returns.", "Tomorrow trains.", "Demo fin."] },
          ],
        },
      ],
      colors: palette.d,
    },
  ];

  const createdManga = [];
  for (const s of series) {
    const coverBuf = await demoPagePng({
      headline: s.title.replace(/^Demo: /, ""),
      lines: [s.genres.join(" · "), "Tap to open chapters"],
      c1: s.colors.c1,
      c2: s.colors.c2,
    });
    const { url: coverUrl } = await uploadBufferToStorage(coverBuf, { folder: "demo/covers", publicId: `cover_${s.title.slice(0, 24)}` });

    const manga = await Manga.create({
      title: s.title,
      titleHe: s.titleHe,
      description: s.description,
      descriptionHe: s.descriptionHe,
      genres: s.genres,
      status: "published",
      coverUrl,
      trendingScore: s.trendingScore,
      createdBy: admin._id,
    });
    createdManga.push(manga);

    for (const ch of s.chapters) {
      await createChapter({
        mangaId: manga._id,
        number: ch.n,
        title: ch.title,
        titleHe: ch.titleHe,
        pagesMeta: ch.pages,
        colors: s.colors,
        premium: ch.premium,
      });
    }
  }

  const m0 = createdManga[0];
  const ch1 = await Chapter.findOne({ mangaId: m0._id, number: 1 }).lean();
  if (ch1) {
    const progressPayload = {
      mangaId: m0._id,
      chapterId: ch1._id,
      pageIndex: 0,
      scrollPositionY: 420,
      readingMode: "vertical",
    };
    await ReadingProgress.create({ userId: reader._id, ...progressPayload });
    await ReadingProgress.create({ userId: demoUser._id, ...progressPayload });
  }

  console.log("Seed OK — demo library ready.");
  console.log("--- משתמשי דמה / Demo accounts ---");
  console.log("1) demo@manga.local  |  סיסמה: DemoRead2026!  (משתמש דמה רגיל)");
  console.log("2) reader@seed.local |  סיסמה: SeedPass123!  (קורא דמו + אותה ספרייה)");
  console.log("3) admin@seed.local  |  סיסמה: SeedPass123!  (מנהל + פרימיום + מתרגם)");
  console.log("Premium test: Chrome Ronin פרק 3 → חומה; בפרופיל אפשר mock premium.");
  await disconnectMongo();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
