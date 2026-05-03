import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import "../components/admin/AdminTable.css";

export default function TranslatorPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [mangaId, setMangaId] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [chapterId, setChapterId] = useState("");
  const [heUrlsText, setHeUrlsText] = useState("");
  const [msg, setMsg] = useState("");
  const [chapterImageFiles, setChapterImageFiles] = useState([]);
  const [chNumInput, setChNumInput] = useState("");
  const [chTitleInput, setChTitleInput] = useState("");
  const [fromImagesBusy, setFromImagesBusy] = useState(false);
  const heFilesRef = useRef(null);

  const myWorkQ = useQuery({
    queryKey: ["manga", "my-work"],
    queryFn: async () => {
      const { data } = await api.get("/api/manga/my-work");
      return data.items || [];
    },
  });

  const assignQ = useQuery({
    queryKey: ["translate", "my-assignments"],
    queryFn: async () => {
      const { data } = await api.get("/api/translate/my-assignments");
      return data.items || [];
    },
  });

  const chaptersQ = useQuery({
    queryKey: ["chapters", "manga", mangaId],
    queryFn: async () => {
      const { data } = await api.get(`/api/chapters/manga/${mangaId}`);
      return data.items || [];
    },
    enabled: Boolean(mangaId),
  });

  useEffect(() => {
    setChapterId("");
  }, [mangaId]);

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/manga", { title }),
    onSuccess: (res) => {
      const id = res.data?.manga?._id;
      if (id) setMangaId(String(id));
      setMsg(t("translator.createdManga"));
      qc.invalidateQueries({ queryKey: ["manga", "my-work"] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/api/manga/${mangaId}/submit-for-review`),
    onSuccess: () => {
      setMsg(t("translator.submitted"));
      qc.invalidateQueries({ queryKey: ["manga", "my-work"] });
    },
    onError: (err) => {
      const e = err?.response?.data?.error;
      setMsg(e || t("translator.submitBlockedWrongStatus"));
    },
  });

  async function translateMangaMeta() {
    setMsg("");
    if (!mangaId) return;
    const { data } = await api.post(`/api/translate/manga/${mangaId}`, {});
    setMsg(data.mock ? t("translator.mangaTranslatedMock") : t("translator.mangaTranslated"));
  }

  async function translateChapterTitle() {
    setMsg("");
    if (!chapterId) return;
    await api.post(`/api/translate/chapter/${chapterId}/draft`, { publish: true });
    await qc.invalidateQueries({ queryKey: ["chapters", "manga", mangaId] });
    setMsg(t("translator.chapterTitleDone"));
  }

  async function applyHePageUrls() {
    setMsg("");
    if (!chapterId) return;
    const lines = heUrlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const overlays = lines.map((imageUrlHe, index) => ({ index, imageUrlHe }));
    await api.patch(`/api/chapters/${chapterId}`, { pageHeOverlays: overlays });
    setMsg(t("translator.hePagesApplied", { count: String(overlays.length) }));
  }

  async function uploadHeZip() {
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/api/bulk-upload/preview", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setPreview(data);
  }

  async function ingest() {
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    await api.post(`/api/bulk-upload/manga/${mangaId}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    setMsg(t("translator.ingestDone"));
    qc.invalidateQueries({ queryKey: ["chapters", "manga", mangaId] });
    qc.invalidateQueries({ queryKey: ["manga", "my-work"] });
  }

  async function uploadHeImages(e) {
    setMsg("");
    const list = e?.target?.files?.length ? Array.from(e.target.files) : [];
    if (!list.length || !chapterId) return;
    const fd = new FormData();
    fd.append("folder", `manga/${mangaId}/he/${chapterId}`);
    for (const f of list) fd.append("files", f);
    const { data } = await api.post("/api/upload/images", fd, { headers: { "Content-Type": "multipart/form-data" } });
    const urls = data.urls || [];
    const overlays = urls.map((imageUrlHe, index) => ({ index, imageUrlHe }));
    await api.patch(`/api/chapters/${chapterId}`, { pageHeOverlays: overlays });
    setHeUrlsText(urls.join("\n"));
    setMsg(t("translator.heUploadDone", { count: String(urls.length) }));
    e.target.value = "";
  }

  async function submitChapterReview() {
    setMsg("");
    if (!chapterId) return;
    try {
      await api.post(`/api/translate/chapter/${chapterId}/submit-review`);
      setMsg(t("translator.chapterSubmitted"));
      qc.invalidateQueries({ queryKey: ["translate", "my-assignments"] });
    } catch (err) {
      setMsg(err?.response?.data?.error || "—");
    }
  }

  async function createChapterFromImagesSubmit() {
    setMsg("");
    if (!mangaId || chapterImageFiles.length === 0) return;
    setFromImagesBusy(true);
    try {
      const fd = new FormData();
      for (const f of chapterImageFiles) fd.append("files", f);
      if (chNumInput.trim()) fd.append("number", chNumInput.trim());
      if (chTitleInput.trim()) fd.append("title", chTitleInput.trim());
      const { data } = await api.post(`/api/chapters/manga/${mangaId}/from-images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const n = data.chapter?.pages?.length ?? 0;
      setMsg(t("translator.fromImagesDone", { n: String(n) }));
      setChapterImageFiles([]);
      setChNumInput("");
      setChTitleInput("");
      qc.invalidateQueries({ queryKey: ["chapters", "manga", mangaId] });
      qc.invalidateQueries({ queryKey: ["manga", "my-work"] });
    } catch (err) {
      setMsg(err?.response?.data?.error || "—");
    } finally {
      setFromImagesBusy(false);
    }
  }

  const chapters = chaptersQ.data ?? [];
  const my = myWorkQ.data ?? [];
  const assigns = assignQ.data ?? [];
  const current = my.find((m) => String(m._id) === String(mangaId));
  const canSubmit = Boolean(mangaId && current && ["draft", "rejected"].includes(current.status) && chapters.length > 0);
  const uploadsLocked = Boolean(mangaId && current && !["draft", "rejected"].includes(current.status));

  return (
    <div className="page-shell translator-console">
      <h1 className="translator-console-title">{t("translator.title")}</h1>

      <section className="glass-panel translator-workflow-banner">
        <h2 className="translator-h2">{t("translator.workflowTitle")}</h2>
        <p className="translator-hint translator-workflow-copy">{t("translator.workflowBody")}</p>
        <p className="translator-hint" style={{ marginTop: 8 }}>
          {t("translator.workspaceLead")}
        </p>
        <p className="translator-role-hint">{t("translator.roleHint")}</p>
      </section>

      <section className="glass-panel translator-block">
        <h2 className="translator-h2">{t("translator.myAssignments")}</h2>
        {assignQ.isLoading && <p className="translator-hint">…</p>}
        {!assignQ.isLoading && !assigns.length && <p className="translator-hint">{t("translator.assignmentsEmpty")}</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {assigns.map((row) => {
            const mid = row.mangaId?._id || row.mangaId;
            const cid = row.chapterId?._id || row.chapterId;
            const mt = row.mangaId?.title || "—";
            const num = row.chapterId?.number;
            return (
              <li key={row._id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontWeight: 600 }}>
                  {mt} · #{num}
                </span>
                <span className="translator-hint">{row.status}</span>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setMangaId(String(mid));
                    setChapterId(String(cid));
                  }}
                >
                  {t("translator.assignLoadTools")}
                </button>
                <Link to={`/read/${cid}`} className="chip">
                  {t("translator.openReader")}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="glass-panel translator-block">
        <h2 className="translator-h2">{t("translator.mySeries")}</h2>
        <p className="translator-hint">{t("translator.selectSeries")}</p>
        <select className="translator-input" value={mangaId} onChange={(e) => setMangaId(e.target.value)}>
          <option value="">—</option>
          {my.map((m) => (
            <option key={m._id} value={m._id}>
              {m.title} · {m.status}
            </option>
          ))}
        </select>
        {current && (
          <p className="translator-meta">
            {t("translator.statusLabel")}: <strong>{current.status}</strong>
          </p>
        )}
        <div className="translator-inline">
          <input
            className="translator-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("translator.newTitlePlaceholder")}
          />
          <button type="button" className="neon-btn" disabled={!title.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {t("translator.createManga")}
          </button>
        </div>
        <button
          type="button"
          className="neon-btn translator-submit-btn"
          disabled={!canSubmit || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {t("translator.submitReview")}
        </button>
        {!canSubmit && mangaId && current && ["draft", "rejected"].includes(current.status) && chapters.length === 0 && (
          <p className="translator-warn">{t("translator.submitBlockedNoChapters")}</p>
        )}
        {uploadsLocked && <p className="translator-warn">{t("translator.uploadsLocked")}</p>}
      </section>

      <section className="glass-panel translator-block translator-block--wide">
        <h2 className="translator-h2">{t("translator.sectionFromImages")}</h2>
        <p className="translator-hint">{t("translator.fromImagesTitle")}</p>
        <p className="translator-hint">{t("translator.fromImagesHint")}</p>
        <label className="translator-hint" style={{ display: "block", marginTop: 10 }}>
          {t("translator.fromImagesNumber")}
          <input
            className="translator-input"
            style={{ marginTop: 6, width: "100%", maxWidth: 200 }}
            type="number"
            min={1}
            value={chNumInput}
            onChange={(e) => setChNumInput(e.target.value)}
            disabled={uploadsLocked || !mangaId}
          />
        </label>
        <label className="translator-hint" style={{ display: "block", marginTop: 10 }}>
          {t("translator.fromImagesChapterTitle")}
          <input
            className="translator-input"
            style={{ marginTop: 6, width: "100%", maxWidth: 420 }}
            value={chTitleInput}
            onChange={(e) => setChTitleInput(e.target.value)}
            disabled={uploadsLocked || !mangaId}
          />
        </label>
        <div className="translator-inline" style={{ marginTop: 12 }}>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploadsLocked || !mangaId}
            onChange={(e) => setChapterImageFiles(Array.from(e.target.files || []))}
          />
        </div>
        {chapterImageFiles.length > 0 && <p className="translator-meta">{t("translator.fromImagesPicked", { n: String(chapterImageFiles.length) })}</p>}
        <button
          type="button"
          className="neon-btn"
          style={{ marginTop: 12 }}
          disabled={uploadsLocked || !mangaId || chapterImageFiles.length === 0 || fromImagesBusy}
          onClick={() => createChapterFromImagesSubmit()}
        >
          {fromImagesBusy ? t("translator.fromImagesBusy") : t("translator.fromImagesSubmit")}
        </button>
      </section>

      <div className="translator-grid">
        <div className="glass-panel translator-block">
          <h2 className="translator-h2">{t("translator.sectionAi")}</h2>
          <p className="translator-hint">{t("translator.aiHint")}</p>
          <button type="button" className="neon-btn" disabled={!mangaId || uploadsLocked} onClick={translateMangaMeta}>
            {t("translator.translateManga")}
          </button>
        </div>

        <div className="glass-panel translator-block">
          <h2 className="translator-h2">{t("translator.sectionChapters")}</h2>
          {chapters.length > 0 && (
            <select className="translator-input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">{t("translator.pickChapter")}</option>
              {chapters.map((c) => (
                <option key={c._id} value={c._id}>
                  #{c.number} — {c.title || "—"} / {c.titleHe || "—"}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="chip" disabled={!chapterId} onClick={translateChapterTitle}>
            {t("translator.translateChapterTitle")}
          </button>
          <button type="button" className="neon-btn" style={{ marginTop: 10 }} disabled={!chapterId} onClick={submitChapterReview}>
            {t("translator.submitChapterReview")}
          </button>
        </div>

        <div className="glass-panel translator-block translator-block--wide">
          <h2 className="translator-h2">{t("translator.sectionHePages")}</h2>
          <p className="translator-hint">{t("translator.heUrlsHint")}</p>
          <textarea className="translator-textarea" value={heUrlsText} onChange={(e) => setHeUrlsText(e.target.value)} rows={5} placeholder="https://…" />
          <div className="translator-inline">
            <button type="button" className="neon-btn" disabled={!chapterId} onClick={applyHePageUrls}>
              {t("translator.applyHeUrls")}
            </button>
            <button type="button" className="chip" disabled={!chapterId} onClick={() => heFilesRef.current?.click()}>
              {t("translator.uploadHeMulti")}
            </button>
          </div>
          <input ref={heFilesRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadHeImages(e)} />
          <p className="translator-hint">{t("translator.heUploadHint")}</p>
        </div>

        <div className="glass-panel translator-block translator-block--wide">
          <h2 className="translator-h2">{t("translator.sectionZip")}</h2>
          <p className="translator-hint">{t("translator.bulk")}</p>
          <input type="file" accept=".zip,application/zip" disabled={uploadsLocked} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="translator-inline">
            <button type="button" className="chip" onClick={uploadHeZip} disabled={!file || uploadsLocked}>
              {t("translator.preview")}
            </button>
            <button type="button" className="neon-btn" onClick={ingest} disabled={!file || !mangaId || uploadsLocked}>
              {t("translator.ingest")}
            </button>
          </div>
          {preview ? <pre className="translator-pre">{JSON.stringify(preview, null, 2)}</pre> : null}
        </div>
      </div>

      {msg && <p className="translator-msg glass-panel">{msg}</p>}
    </div>
  );
}
