import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/ai_manga_reader";

export async function connectMongo(uri = process.env.MONGODB_URI || DEFAULT_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export function disconnectMongo() {
  return mongoose.disconnect();
}
