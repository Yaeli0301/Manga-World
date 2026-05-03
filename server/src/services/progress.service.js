import { ReadingProgress } from "../models/ReadingProgress.model.js";
import { User } from "../models/User.model.js";

const MAX_VISITED_CHAPTERS = 800;

function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Updates streak when activity happens on a new UTC calendar day. */
async function bumpReadingStreak(userId) {
  const today = utcDay();
  const u = await User.findById(userId).select("readingStreak lastReadUtcDay").lean();
  if (!u) return;
  const last = u.lastReadUtcDay || "";
  if (last === today) return;
  let streak = 1;
  if (last) {
    const prev = new Date(`${last}T12:00:00.000Z`);
    const cur = new Date(`${today}T12:00:00.000Z`);
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) streak = Math.max(1, (u.readingStreak || 0) + 1);
  }
  await User.updateOne({ _id: userId }, { $set: { readingStreak: streak, lastReadUtcDay: today } });
}

async function recordUniqueChapterVisit(userId, chapterId) {
  const u = await User.findById(userId).select("chapterIdsVisited").lean();
  const arr = u?.chapterIdsVisited || [];
  const sid = String(chapterId);
  if (arr.some((id) => String(id) === sid)) return;
  if (arr.length >= MAX_VISITED_CHAPTERS) return;
  await User.updateOne({ _id: userId }, { $push: { chapterIdsVisited: chapterId } });
}

export async function upsertProgress({ userId, mangaId, chapterId, pageIndex, scrollPositionY, readingMode }) {
  const prev = await ReadingProgress.findOne({ userId, mangaId }).select("chapterId").lean();
  const doc = await ReadingProgress.findOneAndUpdate(
    { userId, mangaId },
    {
      userId,
      mangaId,
      chapterId,
      pageIndex,
      scrollPositionY,
      readingMode,
      updatedAtSnapshot: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (!prev || String(prev.chapterId) !== String(chapterId)) {
    await recordUniqueChapterVisit(userId, chapterId);
  }
  await bumpReadingStreak(userId).catch(() => {});
  return doc;
}

export async function getProgressForUser(userId, mangaId) {
  return ReadingProgress.findOne({ userId, mangaId }).lean();
}

export async function listProgressForUser(userId) {
  return ReadingProgress.find({ userId })
    .sort({ updatedAt: -1 })
    .populate("mangaId", "title titleHe coverUrl status")
    .populate("chapterId", "number title titleHe")
    .lean();
}
