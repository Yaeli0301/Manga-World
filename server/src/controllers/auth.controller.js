import bcrypt from "bcryptjs";
import { User } from "../models/User.model.js";
import { issueTokenPair, refreshWithToken, revokeRefreshToken } from "../services/authTokens.service.js";

export async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || "",
      roles: ["user"],
    });
    const ua = req.get("user-agent") || "";
    const { accessToken, refreshToken } = await issueTokenPair(user._id.toString(), ua);
    res.status(201).json({ token: accessToken, accessToken, refreshToken, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password || "", user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    user.lastActiveAt = new Date();
    await user.save();
    const ua = req.get("user-agent") || "";
    const { accessToken, refreshToken } = await issueTokenPair(user._id.toString(), ua);
    res.json({ token: accessToken, accessToken, refreshToken, user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.body?.refreshToken;
    const out = await refreshWithToken(refreshToken);
    if (!out) return res.status(401).json({ error: "Invalid or expired refresh token" });
    res.json({ token: out.accessToken, accessToken: out.accessToken });
  } catch (e) {
    next(e);
  }
}

/** Revokes a single opaque refresh token (client should discard it). */
export async function logoutRefresh(req, res, next) {
  try {
    await revokeRefreshToken(req.body?.refreshToken);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { displayName, language, theme } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    if (displayName !== undefined) user.displayName = displayName;
    if (language !== undefined && ["en", "he"].includes(language)) user.language = language;
    if (theme !== undefined && ["dark", "light"].includes(theme)) user.theme = theme;
    await user.save();
    res.json({ user: user.toPublicJSON() });
  } catch (e) {
    next(e);
  }
}
