import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import { ChapterComment } from "../models/ChapterComment.model.js";
import { listMangaQuery, trendingMangaQuery, distinctGenres } from "../services/catalogQuery.service.js";
import { chapterViewerPayload } from "../services/chapterViewer.service.js";

function gqlReqLike(ctx, gqlQuery = {}) {
  const h = {};
  if (ctx.contentLanguageHeader) h["x-content-language"] = ctx.contentLanguageHeader;
  return {
    headers: h,
    user: ctx.viewer,
    query: gqlQuery,
  };
}

function mapMangaListItem(doc) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    coverUrl: doc.coverUrl || "",
    description: doc.description || "",
    genres: doc.genres || [],
    status: doc.status,
    trendingScore: doc.trendingScore ?? 0,
  };
}

function mapChapterPayload(payload) {
  const ch = payload.chapter;
  const mg = payload.manga;
  const pages = (ch.pages || []).map((p) => ({
    index: p.index,
    url: p.imageUrl || "",
    width: p.width,
    height: p.height,
  }));
  const mid = mg._id || mg.id;
  return {
    chapter: {
      id: ch._id.toString(),
      number: ch.number,
      title: ch.title || "",
      locked: Boolean(ch.locked),
      pages,
    },
    manga: {
      id: mid.toString(),
      title: mg.title,
      isFavorite: Boolean(mg.isFavorite),
    },
  };
}

export const resolvers = {
  Query: {
    health: () => true,
    genres: () => distinctGenres(),
    me: async (_root, _args, ctx) => {
      if (!ctx.viewer?.id) return null;
      const u = await User.findById(ctx.viewer.id).lean();
      if (!u) return null;
      return {
        id: u._id.toString(),
        email: u.email,
        displayName: u.displayName,
        roles: u.roles || [],
        readingStreak: u.readingStreak ?? 0,
        language: u.language || "en",
      };
    },
    trending: async (_root, { limit }, ctx) => {
      const lim = Math.min(Math.max(limit ?? 12, 1), 40);
      const items = await trendingMangaQuery(gqlReqLike(ctx), lim);
      return items.map(mapMangaListItem);
    },
    catalog: async (_root, args, ctx) => {
      const out = await listMangaQuery(
        {
          q: args.q,
          page: args.page ?? 1,
          limit: args.limit ?? 20,
          sort: args.sort ?? "updated",
          genre: args.genre,
          status: "published",
        },
        gqlReqLike(ctx)
      );
      return { ...out, items: out.items.map(mapMangaListItem) };
    },
    chapter: async (_root, { id }, ctx) => {
      const payload = await chapterViewerPayload(id, ctx.viewer, ctx.contentLanguageHeader);
      if (!payload) throw new Error("NOT_FOUND");
      return mapChapterPayload(payload);
    },
  },
  Mutation: {
    toggleCommentLike: async (_root, { commentId }, ctx) => {
      if (!ctx.viewer?.id) throw new Error("UNAUTHENTICATED");
      if (!mongoose.isValidObjectId(commentId)) throw new Error("INVALID_ID");
      const uid = new mongoose.Types.ObjectId(ctx.viewer.id);
      const c = await ChapterComment.findById(commentId).select("likes").lean();
      if (!c) throw new Error("NOT_FOUND");
      const likes = (c.likes || []).map((x) => x.toString());
      const liked = likes.includes(ctx.viewer.id);
      await ChapterComment.updateOne({ _id: commentId }, liked ? { $pull: { likes: uid } } : { $addToSet: { likes: uid } });
      const nextCount = liked ? likes.length - 1 : likes.length + 1;
      return { liked: !liked, likeCount: Math.max(0, nextCount) };
    },
  },
};
