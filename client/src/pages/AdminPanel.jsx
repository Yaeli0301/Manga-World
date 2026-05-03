import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import "../components/admin/AdminTable.css";

const ROLES = ["user", "premium", "translator", "admin"];
const ADMIN_TABS = ["overview", "queue", "chapters", "moderation", "assignments", "analytics", "users"];

function ownerLabel(m) {
  const c = m.createdBy;
  if (!c) return "—";
  if (typeof c === "object") return c.displayName || c.email || "—";
  return "—";
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [selected, setSelected] = useState(() => new Set());
  const [mangaForChapters, setMangaForChapters] = useState("");
  const [edits, setEdits] = useState({});
  const [roleDraft, setRoleDraft] = useState({});
  const [mangaAssign, setMangaAssign] = useState("");
  const [assignTranslatorId, setAssignTranslatorId] = useState("");
  const [assignChapterIdsText, setAssignChapterIdsText] = useState("");
  const [assignMsg, setAssignMsg] = useState("");
  const [rejectNoteByChapter, setRejectNoteByChapter] = useState({});
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDisplay, setCreateDisplay] = useState("");
  const [createRoles, setCreateRoles] = useState(["user", "translator"]);
  const [createMsg, setCreateMsg] = useState("");

  const statsQ = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/stats");
      return data;
    },
    enabled: tab === "overview",
  });

  const queueQ = useQuery({
    queryKey: ["admin", "manga", "queue"],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/manga", { params: { status: "pending,draft", limit: 100, page: 1 } });
      return data.items || [];
    },
    enabled: tab === "queue",
  });

  const catalogQ = useQuery({
    queryKey: ["admin", "manga", { status: "all", limit: 200 }],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/manga", { params: { status: "all", limit: 200, page: 1 } });
      return data.items || [];
    },
    enabled: tab === "chapters" || tab === "assignments",
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/users");
      return data.items || [];
    },
    enabled: tab === "users" || tab === "assignments",
  });

  const chaptersAssignQ = useQuery({
    queryKey: ["chapters", "manga", mangaAssign, "assign"],
    queryFn: async () => {
      const { data } = await api.get(`/api/chapters/manga/${mangaAssign}`);
      return data.items || [];
    },
    enabled: Boolean(mangaAssign) && tab === "assignments",
  });

  const pendingReviewQ = useQuery({
    queryKey: ["admin", "chapters", "pending-review"],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/chapters/pending-review");
      return data.items || [];
    },
    enabled: tab === "moderation",
  });

  const analyticsQ = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/analytics");
      return data;
    },
    enabled: tab === "analytics",
  });

  const allAssignmentsQ = useQuery({
    queryKey: ["admin", "assignments", "all"],
    queryFn: async () => {
      const { data } = await api.get("/api/admin/assignments");
      return data.items || [];
    },
    enabled: tab === "assignments",
  });

  const chaptersQ = useQuery({
    queryKey: ["chapters", "manga", mangaForChapters],
    queryFn: async () => {
      const { data } = await api.get(`/api/chapters/manga/${mangaForChapters}`);
      return data.items || [];
    },
    enabled: Boolean(mangaForChapters) && tab === "chapters",
  });

  const mangaMetaQ = useQuery({
    queryKey: ["manga", mangaForChapters, "detail"],
    queryFn: async () => {
      const { data } = await api.get(`/api/manga/${mangaForChapters}`);
      return data.manga;
    },
    enabled: Boolean(mangaForChapters) && tab === "chapters",
  });

  useEffect(() => {
    const items = usersQ.data;
    if (!items) return;
    const next = {};
    for (const u of items) {
      next[u._id] = [...(u.roles || [])];
    }
    setRoleDraft(next);
  }, [usersQ.data]);

  useEffect(() => {
    const items = chaptersQ.data;
    if (!items) return;
    const next = {};
    for (const c of items) {
      next[c._id] = {
        title: c.title || "",
        titleHe: c.titleHe || "",
        isPremiumOnly: Boolean(c.isPremiumOnly),
      };
    }
    setEdits(next);
  }, [chaptersQ.data]);

  const patchMangaPremiumMutation = useMutation({
    mutationFn: ({ mangaId, isPremiumOnly }) => api.patch(`/api/admin/manga/${mangaId}`, { isPremiumOnly }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manga", mangaForChapters, "detail"] });
      qc.invalidateQueries({ queryKey: ["admin", "manga"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }) => api.post("/api/admin/manga/bulk-status", { ids, status }),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const saveChapterMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/api/chapters/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters", "manga", mangaForChapters] }),
  });

  const assignMutation = useMutation({
    mutationFn: (body) => api.post("/api/admin/assignments", body),
    onSuccess: (res) => {
      setAssignMsg(String(res.data?.count ?? ""));
      qc.invalidateQueries({ queryKey: ["admin", "assignments"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      setTimeout(() => setAssignMsg(""), 4000);
    },
    onError: () => setAssignMsg("error"),
  });

  const approveTrMutation = useMutation({
    mutationFn: (chapterId) => api.post(`/api/admin/chapters/${chapterId}/approve-translation`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "chapters", "pending-review"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const rejectTrMutation = useMutation({
    mutationFn: ({ chapterId, note }) => api.post(`/api/admin/chapters/${chapterId}/reject-translation`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "chapters", "pending-review"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (body) => api.post("/api/admin/users", body),
    onSuccess: () => {
      setCreateMsg("ok");
      setCreateEmail("");
      setCreatePassword("");
      setCreateDisplay("");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      setTimeout(() => setCreateMsg(""), 3000);
    },
    onError: (err) => setCreateMsg(err?.response?.data?.error || "error"),
  });

  const [rolesMsg, setRolesMsg] = useState("");
  const rolesMutation = useMutation({
    mutationFn: ({ userId, roles }) => api.patch(`/api/admin/users/${userId}/roles`, { roles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      setRolesMsg(t("admin.rolesSaved"));
      setTimeout(() => setRolesMsg(""), 3000);
    },
  });

  const queue = queueQ.data ?? [];
  const pendingIds = useMemo(() => queue.map((m) => m._id), [queue]);
  const allSelected = queue.length > 0 && queue.every((m) => selected.has(m._id));

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAllQueue() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pendingIds));
  }

  function runBulk(status) {
    const ids = [...selected];
    if (!ids.length) return;
    bulkMutation.mutate({ ids, status });
  }

  function updateEdit(id, field, value) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function toggleRoleDraft(userId, role) {
    setRoleDraft((prev) => {
      const cur = [...(prev[userId] || [])];
      const i = cur.indexOf(role);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(role);
      if (!cur.includes("user")) cur.push("user");
      return { ...prev, [userId]: cur };
    });
  }

  const catalog = catalogQ.data ?? [];
  const translatorsPick = (usersQ.data || []).filter((u) => (u.roles || []).includes("translator"));
  const pendingChapters = pendingReviewQ.data ?? [];
  const analytics = analyticsQ.data;
  const assignChapters = chaptersAssignQ.data ?? [];

  return (
    <div className="page-shell admin-console">
      <h1 className="admin-console-title">{t("admin.title")}</h1>

      <nav className="admin-tabs" aria-label="Admin sections">
        {ADMIN_TABS.map((id) => (
          <button key={id} type="button" className={`admin-tab chip ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {t(`admin.tab${id.charAt(0).toUpperCase() + id.slice(1)}`)}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="admin-stats-grid">
          {statsQ.isLoading && <p className="search-muted">…</p>}
          {statsQ.data && (
            <>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.pending}</span>
                <span className="admin-stat-label">{t("admin.statsPending")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.draft}</span>
                <span className="admin-stat-label">{t("admin.statsDraft")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.published}</span>
                <span className="admin-stat-label">{t("admin.statsPublished")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.rejected}</span>
                <span className="admin-stat-label">{t("admin.statsRejected")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.users}</span>
                <span className="admin-stat-label">{t("admin.statsUsers")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.translators}</span>
                <span className="admin-stat-label">{t("admin.statsTranslators")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.pendingTranslationReviews ?? 0}</span>
                <span className="admin-stat-label">{t("admin.statsPendingReviews")}</span>
              </div>
              <div className="glass-panel admin-stat-card">
                <span className="admin-stat-value">{statsQ.data.openAssignments ?? 0}</span>
                <span className="admin-stat-label">{t("admin.statsOpenAssignments")}</span>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "queue" && (
        <section>
          <div className="admin-toolbar">
            <button type="button" className="chip" onClick={toggleAllQueue}>
              {t("admin.selectAll")}
            </button>
            <button type="button" className="neon-btn" onClick={() => runBulk("published")} disabled={!selected.size || bulkMutation.isPending}>
              {t("admin.publishSelected")}
            </button>
            <button type="button" className="chip" onClick={() => runBulk("rejected")} disabled={!selected.size || bulkMutation.isPending}>
              {t("admin.rejectSelected")}
            </button>
          </div>
          <div className="admin-table-wrap glass-panel">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>{t("admin.title_col")}</th>
                  <th>{t("admin.owner")}</th>
                  <th>{t("admin.status")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <input type="checkbox" checked={selected.has(m._id)} onChange={() => toggle(m._id)} />
                    </td>
                    <td>{m.title}</td>
                    <td>{ownerLabel(m)}</td>
                    <td>{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "chapters" && (
        <section>
          <label className="glass-panel admin-field-block">
            <span className="admin-field-label">{t("admin.pickManga")}</span>
            <select className="admin-select" value={mangaForChapters} onChange={(e) => setMangaForChapters(e.target.value)}>
              <option value="">—</option>
              {catalog.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title} ({m.status})
                </option>
              ))}
            </select>
          </label>

          {mangaForChapters && mangaMetaQ.data && (
            <label className="glass-panel admin-premium-row">
              <input
                type="checkbox"
                checked={Boolean(mangaMetaQ.data.isPremiumOnly)}
                disabled={patchMangaPremiumMutation.isPending}
                onChange={(e) => patchMangaPremiumMutation.mutate({ mangaId: mangaForChapters, isPremiumOnly: e.target.checked })}
              />
              <span>{t("admin.mangaPremiumSeries")}</span>
            </label>
          )}

          {chaptersQ.isLoading && mangaForChapters && <p className="search-muted">…</p>}
          <div className="admin-chapter-editor">
            {(chaptersQ.data || []).map((c) => {
              const e = edits[c._id] || { title: "", titleHe: "", isPremiumOnly: false };
              return (
                <div key={c._id} className="glass-panel admin-chapter-row">
                  <span className="admin-ch-num">#{c.number}</span>
                  <input className="admin-input" value={e.title} onChange={(ev) => updateEdit(c._id, "title", ev.target.value)} placeholder="title" />
                  <input className="admin-input" value={e.titleHe} onChange={(ev) => updateEdit(c._id, "titleHe", ev.target.value)} placeholder="title HE" />
                  <label className="admin-prem-inline">
                    <input type="checkbox" checked={e.isPremiumOnly} onChange={(ev) => updateEdit(c._id, "isPremiumOnly", ev.target.checked)} />
                    {t("admin.premium")}
                  </label>
                  <button
                    type="button"
                    className="neon-btn"
                    disabled={saveChapterMutation.isPending}
                    onClick={() =>
                      saveChapterMutation.mutate({
                        id: c._id,
                        body: { title: e.title, titleHe: e.titleHe, isPremiumOnly: e.isPremiumOnly },
                      })
                    }
                  >
                    {t("admin.saveChapter")}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "moderation" && (
        <section>
          <p className="search-muted">{t("admin.moderationLead")}</p>
          {pendingReviewQ.isLoading && <p className="search-muted">…</p>}
          <div className="admin-chapter-editor">
            {pendingChapters.map((c) => {
              const mt = c.mangaId && typeof c.mangaId === "object" ? c.mangaId.title : "";
              return (
                <div key={c._id} className="glass-panel admin-chapter-row" style={{ flexWrap: "wrap", gap: 8 }}>
                  <span className="admin-ch-num">
                    {mt} · #{c.number}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{c.translationStatus}</span>
                  <input
                    className="admin-input"
                    style={{ flex: "1 1 200px" }}
                    placeholder={t("admin.rejectNotePlaceholder")}
                    value={rejectNoteByChapter[c._id] || ""}
                    onChange={(ev) => setRejectNoteByChapter((prev) => ({ ...prev, [c._id]: ev.target.value }))}
                  />
                  <button type="button" className="neon-btn" disabled={approveTrMutation.isPending} onClick={() => approveTrMutation.mutate(c._id)}>
                    {t("admin.approveTranslation")}
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={rejectTrMutation.isPending}
                    onClick={() => rejectTrMutation.mutate({ chapterId: c._id, note: rejectNoteByChapter[c._id] || "" })}
                  >
                    {t("admin.rejectTranslation")}
                  </button>
                </div>
              );
            })}
            {!pendingReviewQ.isLoading && pendingChapters.length === 0 && (
              <p className="search-muted">{t("admin.moderationEmpty")}</p>
            )}
          </div>
        </section>
      )}

      {tab === "assignments" && (
        <section>
          <div className="glass-panel admin-field-block" style={{ marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>{t("admin.assignHeading")}</h3>
            <p className="search-muted">{t("admin.assignHint")}</p>
            <label className="admin-field-label">{t("admin.assignTranslator")}</label>
            <select className="admin-select" value={assignTranslatorId} onChange={(e) => setAssignTranslatorId(e.target.value)}>
              <option value="">—</option>
              {translatorsPick.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.email}
                </option>
              ))}
            </select>
            <label className="admin-field-label" style={{ marginTop: 10 }}>
              {t("admin.pickManga")}
            </label>
            <select className="admin-select" value={mangaAssign} onChange={(e) => setMangaAssign(e.target.value)}>
              <option value="">—</option>
              {catalog.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title}
                </option>
              ))}
            </select>
            {mangaAssign && (
              <>
                <p className="search-muted" style={{ marginTop: 8 }}>
                  {t("admin.assignPickChapters")}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {assignChapters.map((c) => (
                    <label key={c._id} className="chip" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={assignChapterIdsText
                          .split(/[,\s]+/)
                          .map((s) => s.trim())
                          .includes(String(c._id))}
                        onChange={(ev) => {
                          const id = String(c._id);
                          setAssignChapterIdsText((prev) => {
                            const set = new Set(
                              prev
                                .split(/[,\s]+/)
                                .map((s) => s.trim())
                                .filter(Boolean)
                            );
                            if (ev.target.checked) set.add(id);
                            else set.delete(id);
                            return [...set].join(", ");
                          });
                        }}
                      />{" "}
                      #{c.number}
                    </label>
                  ))}
                </div>
              </>
            )}
            <label className="admin-field-label" style={{ marginTop: 10 }}>
              {t("admin.assignChapterIds")}
            </label>
            <textarea
              className="admin-input"
              rows={2}
              value={assignChapterIdsText}
              onChange={(e) => setAssignChapterIdsText(e.target.value)}
              placeholder="64f… , 64f…"
            />
            <button
              type="button"
              className="neon-btn"
              style={{ marginTop: 10 }}
              disabled={!assignTranslatorId || !assignChapterIdsText.trim() || assignMutation.isPending}
              onClick={() => {
                const chapterIds = assignChapterIdsText
                  .split(/[,\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                assignMutation.mutate({ translatorId: assignTranslatorId, chapterIds });
              }}
            >
              {t("admin.assignSave")}
            </button>
            {assignMsg ? <p className="chapter-reaction-success">{assignMsg}</p> : null}
          </div>
          <h3>{t("admin.assignmentsList")}</h3>
          <div className="admin-table-wrap glass-panel">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("admin.assignColTranslator")}</th>
                  <th>{t("admin.title_col")}</th>
                  <th>Chapter</th>
                  <th>{t("admin.status")}</th>
                </tr>
              </thead>
              <tbody>
                {(allAssignmentsQ.data || []).map((row) => (
                  <tr key={row._id}>
                    <td>{row.translatorId?.email || "—"}</td>
                    <td>{row.mangaId?.title || "—"}</td>
                    <td>#{row.chapterId?.number}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "analytics" && (
        <section>
          {analyticsQ.isLoading && <p className="search-muted">…</p>}
          {analytics && (
            <>
              <h3>{t("admin.analyticsMangaViews")}</h3>
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("admin.title_col")}</th>
                      <th>views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.mangaByViews || []).map((m) => (
                      <tr key={m._id}>
                        <td>{m.title}</td>
                        <td>{m.viewCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 style={{ marginTop: 20 }}>{t("admin.analyticsTopChapters")}</h3>
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Manga</th>
                      <th>#</th>
                      <th>reads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.topChapters || []).map((c) => (
                      <tr key={c._id}>
                        <td>{c.mangaId?.title || "—"}</td>
                        <td>{c.number}</td>
                        <td>{c.readCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 style={{ marginTop: 20 }}>{t("admin.analyticsTranslators")}</h3>
              <div className="admin-table-wrap glass-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>{t("admin.statsPublished")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.translatorPerformance || []).map((row) => (
                      <tr key={String(row.translatorId)}>
                        <td>{row.email}</td>
                        <td>{row.completedChapters}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "users" && (
        <section className="admin-users-section">
          <div className="glass-panel" style={{ padding: 16, marginBottom: 12 }}>
            <h3 style={{ marginTop: 0 }}>{t("admin.createUserHeading")}</h3>
            <input className="admin-input" placeholder="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
            <input
              className="admin-input"
              style={{ marginTop: 8 }}
              type="password"
              placeholder="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
            />
            <input
              className="admin-input"
              style={{ marginTop: 8 }}
              placeholder={t("admin.createUserDisplay")}
              value={createDisplay}
              onChange={(e) => setCreateDisplay(e.target.value)}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["translator", "admin", "premium"].map((r) => (
                <label key={r} className="chip">
                  <input
                    type="checkbox"
                    checked={createRoles.includes(r)}
                    onChange={() =>
                      setCreateRoles((prev) => {
                        const n = new Set(prev);
                        if (n.has(r)) n.delete(r);
                        else n.add(r);
                        if (!n.has("user")) n.add("user");
                        return [...n];
                      })
                    }
                  />{" "}
                  {r}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="neon-btn"
              style={{ marginTop: 10 }}
              disabled={!createEmail.trim() || !createPassword || createUserMutation.isPending}
              onClick={() => createUserMutation.mutate({ email: createEmail, password: createPassword, displayName: createDisplay, roles: createRoles })}
            >
              {t("admin.createUserCta")}
            </button>
            {createMsg && <p className="chapter-reaction-success">{createMsg}</p>}
          </div>
          <div className="admin-table-wrap glass-panel">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>{t("admin.tabUsers")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(usersQ.data || []).map((u) => (
                  <tr key={u._id}>
                    <td>{u.email}</td>
                    <td>
                      <div className="admin-role-chips">
                        {ROLES.map((r) => (
                          <label key={r} className="admin-role-chip">
                            <input
                              type="checkbox"
                              checked={(roleDraft[u._id] || []).includes(r)}
                              onChange={() => toggleRoleDraft(u._id, r)}
                              disabled={r === "user"}
                            />
                            {r}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="chip"
                        disabled={rolesMutation.isPending}
                        onClick={() => rolesMutation.mutate({ userId: u._id, roles: roleDraft[u._id] || ["user"] })}
                      >
                        {t("admin.saveRoles")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rolesMsg && <p className="chapter-reaction-success">{rolesMsg}</p>}
        </section>
      )}
    </div>
  );
}
