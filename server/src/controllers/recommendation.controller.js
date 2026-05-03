import { getRecommendationsForUser, aiExplainRecommendations } from "../services/recommendation.service.js";

export async function forYou(req, res, next) {
  try {
    const { items, signals } = await getRecommendationsForUser(req.user.id, 20);
    res.json({ items, signals });
  } catch (e) {
    next(e);
  }
}

export async function explain(req, res, next) {
  try {
    const out = await aiExplainRecommendations({ userId: req.user.id });
    res.json(out);
  } catch (e) {
    next(e);
  }
}
