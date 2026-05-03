import mongoose from "mongoose";

/** `user` = reader account; `premium` adds catalog access; `translator` / `admin` are editorial roles. */
const ROLES = ["user", "premium", "translator", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: "" },
    roles: [{ type: String, enum: ROLES, default: ["user"] }],
    language: { type: String, enum: ["en", "he"], default: "en" },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Manga" }],
    /** Unique chapter ObjectIds the user has opened (capped in app logic) — for reading stats. */
    chapterIdsVisited: [{ type: mongoose.Schema.Types.ObjectId, ref: "Chapter" }],
    stripeCustomerId: { type: String },
    lastActiveAt: { type: Date },
    /** Consecutive UTC calendar days where the user recorded reading progress / chapter opens. */
    readingStreak: { type: Number, default: 0 },
    /** `YYYY-MM-DD` (UTC) of last streak bump. */
    lastReadUtcDay: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    displayName: this.displayName,
    roles: this.roles,
    language: this.language,
    theme: this.theme,
    createdAt: this.createdAt,
    /** Set after a successful Stripe Checkout so the client can open the billing portal. */
    hasBillingCustomer: Boolean(this.stripeCustomerId),
    readingStreak: this.readingStreak ?? 0,
  };
};

export const User = mongoose.model("User", userSchema);
export { ROLES };
