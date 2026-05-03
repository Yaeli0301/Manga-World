import "dotenv/config";
import app from "./app.js";
import { connectMongo } from "./db/mongo.js";

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
