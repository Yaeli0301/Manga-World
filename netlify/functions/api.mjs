import serverless from "serverless-http";
import app from "../../server/src/app.js";
import { connectMongo } from "../../server/src/db/mongo.js";

const expressHandler = serverless(app, { provider: "aws" });

let mongoPromise = null;
async function ensureMongo() {
  if (!mongoPromise) {
    mongoPromise = connectMongo().catch((err) => {
      mongoPromise = null;
      throw err;
    });
  }
  return mongoPromise;
}

function headersToObject(headers) {
  const obj = {};
  for (const [k, v] of headers.entries()) obj[k] = v;
  return obj;
}

export default async (req) => {
  try {
    await ensureMongo();
  } catch (err) {
    return Response.json(
      { error: "Database connection failed", detail: err?.message || String(err) },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  let body = null;
  let isBase64Encoded = false;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > 0) {
      body = buf.toString("base64");
      isBase64Encoded = true;
    }
  }

  const event = {
    httpMethod: req.method,
    path: url.pathname,
    rawPath: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    multiValueQueryStringParameters: {},
    headers: headersToObject(req.headers),
    multiValueHeaders: {},
    body,
    isBase64Encoded,
    requestContext: { http: { method: req.method, path: url.pathname } },
  };

  const result = await expressHandler(event, {});
  const respHeaders = new Headers();
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      if (v !== undefined && v !== null) respHeaders.set(k, String(v));
    }
  }
  if (result.multiValueHeaders) {
    for (const [k, vals] of Object.entries(result.multiValueHeaders)) {
      if (Array.isArray(vals)) {
        for (const v of vals) respHeaders.append(k, String(v));
      }
    }
  }

  let respBody = result.body ?? null;
  if (result.isBase64Encoded && typeof respBody === "string") {
    respBody = Buffer.from(respBody, "base64");
  }

  return new Response(respBody, {
    status: result.statusCode || 200,
    headers: respHeaders,
  });
};

export const config = {
  path: ["/api/*", "/graphql", "/uploads/*"],
};
