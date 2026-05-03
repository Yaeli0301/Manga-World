import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { MangaCard } from "../components/ui/MangaCard";
import { useAuth } from "../context/AuthContext";

export default function Favorites() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const favQ = useQuery({
    queryKey: ["manga", "favorites", i18n.language],
    queryFn: async () => {
      const { data } = await api.get("/api/manga/favorites");
      return data.items || [];
    },
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <div className="page-shell">
        <p>{t("auth.login")}</p>
      </div>
    );
  }

  const items = favQ.data ?? [];

  return (
    <div className="page-shell">
      <h1 style={{ marginTop: 0 }}>{t("favorites.title")}</h1>
      {favQ.isLoading && <p style={{ color: "var(--muted)" }}>…</p>}
      {!favQ.isLoading && !items.length && <p style={{ color: "var(--muted)" }}>{t("favorites.empty")}</p>}
      <div className="grid-feed">
        {items.map((m) => (
          <MangaCard key={m._id} manga={m} />
        ))}
      </div>
    </div>
  );
}
