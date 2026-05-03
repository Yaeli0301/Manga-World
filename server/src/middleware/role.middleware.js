export function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const roles = req.user.roles || [];
    const ok = allowed.some((r) => roles.includes(r));
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export function requirePremiumOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const roles = req.user.roles || [];
  if (roles.includes("admin") || roles.includes("premium")) return next();
  return res.status(402).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
}
