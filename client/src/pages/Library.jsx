import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { MangaCard } from "../components/ui/MangaCard";

export default function Library() {
  const { t, i18n } = useTranslation();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["manga", "list", { limit: 40, page: 1 }, i18n.language],
    queryFn: async () => {
      const { data } = await api.get("/api/manga", { params: { limit: 40, page: 1 } });
      return data.items || [];
    },
  });

  return (
    <div className="page-shell">
      <h1 className="library-page-title">{t("library.title")}</h1>
      {isLoading && (
        <div className="grid-feed">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "3/4", borderRadius: "var(--radius)" }} />
          ))}
        </div>
      )}
      <div className="grid-feed">
        {items.map((m) => (
          <MangaCard key={m._id} manga={m} />
        ))}
      </div>
    </div>
  );
}
