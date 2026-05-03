import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/ai_manga_reader";

let cachedPromise = null;

export async function connectMongo(uri = process.env.MONGODB_URI || DEFAULT_URI) {
  mongoose.set("strictQuery", true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 5,
      })
      .catch((err) => {
        cachedPromise = null;
        throw err;
      });
  }
  await cachedPromise;
  return mongoose.connection;
}

export function disconnectMongo() {
  cachedPromise = null;
  return mongoose.disconnect();
}
