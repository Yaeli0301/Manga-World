import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { typeDefs } from "./typeDefs.js";
import { resolvers } from "./resolvers.js";
import { verifyBearerUser } from "../middleware/auth.middleware.js";

const schema = makeExecutableSchema({ typeDefs, resolvers });

async function buildContext(extra) {
  const req = extra.req || extra.request;
  const hdr = typeof req?.headers?.authorization === "string" ? req.headers.authorization : "";
  const xcRaw =
    typeof req?.headers?.["x-content-language"] === "string" ? req.headers["x-content-language"] : "";
  const xc = xcRaw.toLowerCase();
  const viewer = hdr ? await verifyBearerUser(hdr) : null;
  return {
    viewer,
    contentLanguageHeader: xc === "he" || xc === "en" ? xc : null,
  };
}

/** Express-compatible GraphQL middleware (mount at `/graphql`). */
export function graphqlExpressMiddleware() {
  return createYoga({
    schema,
    context: ({ request, req }) => buildContext({ request, req }),
    maskedErrors: process.env.NODE_ENV === "production",
  });
}
