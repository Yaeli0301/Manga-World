export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && err.stack ? { stack: err.stack } : {}),
  });
}
