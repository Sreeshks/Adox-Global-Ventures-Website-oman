"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./admin.css";

export type CmsContacts = {
  phone: string;
  email: string;
  location: string;
  indiaUrl: string;
  uaeUrl: string;
};

export type CmsField = {
  id: string;
  group: string;
  label: string;
  value: string;
  html: string;
  kind: string;
  maxLength: number;
};

export type CmsContent = {
  contacts: CmsContacts;
  overrides: Record<string, string>;
};

export type CmsState = {
  revision: number;
  updatedAt: string | null;
  owner: { email: string };
  schema: {
    version: number;
    contacts: CmsContacts;
    pages: Array<{ route: string; name: string }>;
    fields: Record<string, CmsField>;
  };
  content: CmsContent;
  history: Array<{ revision: number; updatedAt: string }>;
};

type IconName = "arrow" | "search" | "file" | "globe" | "history" | "check" | "download" | "lock" | "menu" | "close" | "reset" | "alert" | "save";
type PendingAction = "save" | "restore" | "reload" | null;
const CONTACTS_GROUP = "__contacts";
const contactFields: Array<{
  key: keyof CmsContacts;
  label: string;
  hint: string;
  type: "text" | "tel" | "email" | "url";
  maxLength: number;
}> = [
  { key: "phone", label: "Phone number", hint: "Use international format, for example +968 9696 7420. Updates phone and WhatsApp links.", type: "tel", maxLength: 120 },
  { key: "email", label: "Email address", hint: "The email visitors use to contact your team.", type: "email", maxLength: 120 },
  { key: "location", label: "Location", hint: "Your public business location, for example Muscat, Oman.", type: "text", maxLength: 140 },
  { key: "indiaUrl", label: "India website", hint: "Use the full website address beginning with https://.", type: "url", maxLength: 500 },
  { key: "uaeUrl", label: "UAE website", hint: "Use the full website address beginning with https://.", type: "url", maxLength: 500 },
];

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    file: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    reset: <><path d="M3 4v6h6M3 10a9 9 0 1 1 1 8" /></>,
    alert: <><path d="M12 3 2 21h20zM12 9v5M12 17v.5" /></>,
    save: <><path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8" /></>,
  };
  return <svg className={`admin-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function copyContent(content: CmsContent): CmsContent {
  return { contacts: { ...content.contacts }, overrides: { ...content.overrides } };
}

function serializedContent(content: CmsContent) {
  return JSON.stringify({
    contacts: Object.entries(content.contacts).sort(([a], [b]) => a.localeCompare(b)),
    overrides: Object.entries(content.overrides).sort(([a], [b]) => a.localeCompare(b)),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCmsState(value: unknown): value is CmsState {
  if (!isRecord(value) || typeof value.revision !== "number" || !isRecord(value.content) || !isRecord(value.schema) || !isRecord(value.owner)) return false;
  return isRecord(value.content.contacts) && isRecord(value.content.overrides)
    && isRecord(value.schema.fields) && isRecord(value.schema.contacts)
    && Array.isArray(value.schema.pages) && Array.isArray(value.history)
    && typeof value.owner.email === "string" && value.schema.version === 1;
}

function formattedDate(date: string | null) {
  if (!date) return "Original website content";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(parsed) + " UTC";
}

function safePreviewRoute(route: string) {
  return route.startsWith("/") && !route.startsWith("//") && !route.includes("\\") ? route : "/";
}

export default function ContentEditor({ initialData }: { initialData: CmsState }) {
  const [saved, setSaved] = useState(initialData);
  const [draft, setDraft] = useState(() => copyContent(initialData.content));
  const [activeGroup, setActiveGroup] = useState("/");
  const [view, setView] = useState<"content" | "history">("content");
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"site" | "section">("site");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const operationInProgress = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const dirty = serializedContent(draft) !== serializedContent(saved.content);
  const fields = useMemo(() => Object.values(saved.schema.fields), [saved.schema.fields]);
  const fieldGroups = useMemo(() => [...new Set(fields.map((field) => field.group))], [fields]);
  const pages = useMemo(() => [...saved.schema.pages].sort((a, b) => a.route === "/" ? -1 : b.route === "/" ? 1 : a.route.localeCompare(b.route)), [saved.schema.pages]);
  const globalGroups = fieldGroups.filter((group) => !pages.some((page) => page.route === group));
  const groupName = (group: string) => group === CONTACTS_GROUP ? "Contact & regional links" : pages.find((page) => page.route === group)?.name ?? group;
  const currentPage = pages.find((page) => page.route === activeGroup);
  const currentName = groupName(activeGroup);
  const searchTerm = query.trim().toLocaleLowerCase();
  const searchAll = Boolean(searchTerm) && searchScope === "site";
  const effectiveValue = (field: CmsField, content = draft) => content.overrides[field.id] ?? field.value;
  const fieldChanged = (field: CmsField) => draft.overrides[field.id] !== saved.content.overrides[field.id];
  const changedFields = fields.filter(fieldChanged);
  const changedContacts = contactFields.filter(({ key }) => draft.contacts[key] !== saved.content.contacts[key]);
  const changeCount = changedFields.length + changedContacts.length;
  const visibleFields = fields.filter((field) => (searchAll || field.group === activeGroup) && (!searchTerm || `${field.label} ${effectiveValue(field)} ${groupName(field.group)}`.toLocaleLowerCase().includes(searchTerm)));
  const visibleContacts = contactFields.filter((field) => (searchAll || activeGroup === CONTACTS_GROUP) && (!searchTerm || `${field.label} ${draft.contacts[field.key]}`.toLocaleLowerCase().includes(searchTerm)));
  const metadataFields = visibleFields.filter((field) => field.kind === "title" || field.kind === "attribute");
  const copyFields = visibleFields.filter((field) => field.kind !== "title" && field.kind !== "attribute");
  const resultCount = visibleFields.length + visibleContacts.length;
  const isBusy = pending !== null;

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavigationOpen]);

  function selectGroup(group: string) {
    setActiveGroup(group);
    setView("content");
    setQuery("");
    setMobileNavigationOpen(false);
  }

  function updateField(field: CmsField, value: string) {
    setNotice("");
    setDraft((previous) => {
      const overrides = { ...previous.overrides };
      if (value === field.value) delete overrides[field.id];
      else overrides[field.id] = value;
      return { ...previous, overrides };
    });
  }

  function updateContact(key: keyof CmsContacts, value: string) {
    setNotice("");
    setDraft((previous) => ({ ...previous, contacts: { ...previous.contacts, [key]: value } }));
  }

  function acceptState(data: CmsState) {
    setSaved(data);
    setDraft(copyContent(data.content));
    setConflict(false);
    setError("");
  }

  function draftExport() {
    return JSON.stringify({ format: "adox-oman-content-draft", schemaVersion: saved.schema.version, baseRevision: saved.revision, exportedAt: new Date().toISOString(), content: draft }, null, 2);
  }

  function downloadDraft() {
    const url = URL.createObjectURL(new Blob([draftExport()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `adox-oman-draft-r${saved.revision}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Draft download started. This backup includes your unsaved changes; it does not save them to the website.");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draftExport());
      setNotice("Your draft has been copied as JSON. Keep it somewhere safe before loading the latest version.");
    } catch {
      setError("Your browser could not copy the draft. Use Download draft to keep a backup instead.");
    }
  }

  async function requestState(action: Exclude<PendingAction, null>, targetRevision?: number) {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setPending(action);
    setError("");
    setNotice("");
    try {
      const endpoint = action === "restore" ? "/api/cms/restore" : "/api/cms";
      const response = await fetch(endpoint, {
        method: action === "reload" ? "GET" : action === "restore" ? "POST" : "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: action === "reload" ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
        ...(action === "reload" ? {} : { body: JSON.stringify(action === "restore" ? { expectedRevision: saved.revision, targetRevision } : { expectedRevision: saved.revision, content: draft }) }),
      });
      if (response.status === 409) {
        setConflict(true);
        setError("A newer version has been saved. Your draft is still here and has not overwritten it.");
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setError("Your owner session could not be verified. Download your draft before refreshing or signing in again.");
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setError(isRecord(data) && typeof data.error === "string" ? data.error : "The update could not be completed. Your draft has been kept.");
        if (response.status >= 500 && action !== "reload") setConflict(true);
        return;
      }
      if (!isCmsState(data)) {
        throw new Error("Unexpected server response");
      }
      acceptState(data);
      setNotice(action === "save" ? `Changes saved as revision ${data.revision}. Open the website preview to review them.` : action === "restore" ? `Revision ${targetRevision} restored and saved as revision ${data.revision}.` : "The latest saved content is now loaded.");
    } catch {
      setError(action === "reload" ? "The latest content could not be loaded. Your current draft is still here. Check your connection and try again." : "The server response could not be confirmed. Your draft is still here. Download it, then load the latest version to check whether the update was saved.");
      if (action !== "reload") setConflict(true);
    } finally {
      operationInProgress.current = false;
      setPending(null);
    }
  }

  function discardDraft() {
    if (!dirty || !window.confirm("Discard all unsaved changes? Your editor will return to the version you last loaded. This cannot be undone.")) return;
    setDraft(copyContent(saved.content));
    setError("");
    setNotice("Unsaved changes discarded.");
  }

  function reloadLatest() {
    if (dirty && !window.confirm("Load the latest saved version? This will replace your unsaved draft. Download or copy the draft first if you want to keep it.")) return;
    void requestState("reload");
  }

  function restoreRevision(revision: number) {
    if (!window.confirm(`Restore revision ${revision}? This replaces all currently saved website text and contact details.${dirty ? " Your unsaved changes will also be discarded." : ""} Continue?`)) return;
    void requestState("restore", revision);
  }

  function renderField(field: CmsField, index: number) {
    const value = effectiveValue(field);
    const changed = fieldChanged(field);
    const customized = Object.hasOwn(draft.overrides, field.id);
    return (
      <div className={`admin-field ${changed ? "admin-field-changed" : ""}`} key={field.id}>
        <div className="admin-field-heading">
          <label htmlFor={`field-${field.id}`}><span className="admin-field-number">{String(index + 1).padStart(2, "0")}</span>{field.label}</label>
          <span className={`admin-field-status ${changed ? "is-changed" : ""}`}>{changed ? "Unsaved" : customized ? "Edited" : "Original"}</span>
        </div>
        {searchAll && <button className="admin-field-source" type="button" onClick={() => selectGroup(field.group)}>{groupName(field.group)} <span aria-hidden="true">↗</span></button>}
        <textarea
          id={`field-${field.id}`}
          value={value}
          onChange={(event) => updateField(field, event.target.value)}
          maxLength={field.maxLength}
          rows={field.kind === "title" ? 2 : value.length > 240 ? 5 : value.length > 90 ? 3 : 2}
          aria-describedby={`hint-${field.id}`}
          disabled={isBusy}
          spellCheck
        />
        <div className="admin-field-bottom" id={`hint-${field.id}`}>
          <span>{value.length.toLocaleString()} / {field.maxLength.toLocaleString()} characters</span>
          <button type="button" className="admin-text-button" disabled={!customized || isBusy} onClick={() => updateField(field, field.value)} aria-label={`Restore original text for ${field.label}, field ${index + 1}`}><Icon name="reset" /> Restore original</button>
        </div>
      </div>
    );
  }

  function renderContacts() {
    if (!visibleContacts.length) return null;
    return (
      <section className="admin-section" aria-labelledby="contact-section-title">
        <div className="admin-section-heading"><div><span className="admin-eyebrow">Across your website</span><h2 id="contact-section-title">Contact & regional links</h2></div><span className="admin-count">{visibleContacts.length} fields</span></div>
        <p className="admin-section-description">Keep your contact details consistent wherever they appear.</p>
        <div className="admin-contact-grid">
          {visibleContacts.map((field) => {
            const changed = draft.contacts[field.key] !== saved.content.contacts[field.key];
            return <div className={`admin-field ${changed ? "admin-field-changed" : ""}`} key={field.key}>
              <div className="admin-field-heading"><label htmlFor={`contact-${field.key}`}>{field.label}</label><span className={`admin-field-status ${changed ? "is-changed" : ""}`}>{changed ? "Unsaved" : "Saved"}</span></div>
              <input id={`contact-${field.key}`} type={field.type} value={draft.contacts[field.key]} maxLength={field.maxLength} onChange={(event) => updateContact(field.key, event.target.value)} aria-describedby={`contact-hint-${field.key}`} autoComplete="off" disabled={isBusy} />
              <p className="admin-input-hint" id={`contact-hint-${field.key}`}>{field.hint}</p>
              <div className="admin-field-bottom"><span>{draft.contacts[field.key].length} / {field.maxLength}</span><button className="admin-text-button" type="button" disabled={isBusy || draft.contacts[field.key] === saved.schema.contacts[field.key]} onClick={() => updateContact(field.key, saved.schema.contacts[field.key])}><Icon name="reset" /> Restore original</button></div>
            </div>;
          })}
        </div>
      </section>
    );
  }

  const navigationButton = (group: string, label: string, icon: IconName = "file") => {
    const count = group === CONTACTS_GROUP ? contactFields.length : fields.filter((field) => field.group === group).length;
    const changed = group === CONTACTS_GROUP ? changedContacts.length > 0 : changedFields.some((field) => field.group === group);
    return <button key={group} type="button" className={`admin-nav-item ${view === "content" && activeGroup === group ? "is-active" : ""}`} onClick={() => selectGroup(group)} aria-current={view === "content" && activeGroup === group ? "page" : undefined}><Icon name={icon} /><span>{label}</span>{changed ? <span className="admin-nav-dirty" aria-label="Has unsaved changes" /> : <span className="admin-nav-count">{count}</span>}</button>;
  };

  return (
    <div className="adox-admin">
      <a className="admin-skip-link" href="#admin-main">Skip to content editor</a>
      <div className="admin-mobile-header"><span className="admin-wordmark">adox</span><span>Content studio</span><button type="button" className="admin-icon-button" aria-expanded={mobileNavigationOpen} aria-controls="admin-navigation" aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileNavigationOpen(!mobileNavigationOpen)}><Icon name={mobileNavigationOpen ? "close" : "menu"} /></button></div>
      {mobileNavigationOpen && <button className="admin-nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileNavigationOpen(false)} />}
      <aside id="admin-navigation" className={`admin-sidebar ${mobileNavigationOpen ? "is-open" : ""}`} aria-label="Website content navigation">
        <div className="admin-brand"><div className="admin-wordmark">adox<i aria-hidden="true">↗</i></div><div className="admin-brand-caption">GLOBAL VENTURES · OMAN</div></div>
        <div className="admin-workspace-label"><span className="admin-workspace-icon"><Icon name="globe" /></span><div><strong>Content studio</strong><span>Your website, in your words.</span></div></div>
        <nav className="admin-nav-scroll" aria-label="Content sections">
          <p className="admin-nav-label">WEBSITE PAGES <span>{pages.length}</span></p>
          {pages.map((page) => navigationButton(page.route, page.name))}
          <p className="admin-nav-label admin-nav-label-spaced">SHARED CONTENT</p>
          {navigationButton(CONTACTS_GROUP, "Contact & regional links", "globe")}
          {globalGroups.map((group) => navigationButton(group, group, "globe"))}
          <div className="admin-nav-divider" />
          <button type="button" className={`admin-nav-item ${view === "history" ? "is-active" : ""}`} aria-current={view === "history" ? "page" : undefined} onClick={() => { setView("history"); setMobileNavigationOpen(false); }}><Icon name="history" /><span>Version history</span></button>
        </nav>
        <div className="admin-owner"><span className="admin-owner-avatar"><Icon name="lock" /></span><div><strong>Owner access</strong><span title={saved.owner.email}>{saved.owner.email}</span><a href="/signout-with-chatgpt?return_to=%2Fadmin%2F" target="_top" className="admin-signout">Sign out</a></div></div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-breadcrumb"><span>Adox Oman</span><span aria-hidden="true">/</span><strong>{view === "history" ? "Version history" : "Website content"}</strong></div>
          <div className="admin-topbar-actions"><span className="admin-private-badge"><Icon name="lock" /> Owner only</span><a className="admin-button admin-button-outline admin-preview-button" href={safePreviewRoute(currentPage?.route ?? "/")} target="_blank" rel="noopener noreferrer">Preview website <Icon name="arrow" /><span className="admin-sr-only"> (opens saved content in a new tab)</span></a></div>
        </header>

        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <div className="admin-page-heading"><div><span className="admin-eyebrow"><span className="admin-red-dot" /> YOUR WEBSITE WORKSPACE</span><h1>{view === "history" ? <>Good work.<br /><span>Safely saved.</span></> : <>Your words.<br /><span>Your website.</span></>}</h1><p>{view === "history" ? "Review saved versions and restore earlier content when you need it." : "Update your website content, one thoughtful change at a time."}</p></div><div className="admin-version-card"><span className="admin-version-label">CURRENT VERSION</span><strong>{String(saved.revision).padStart(2, "0")}<span>revision</span></strong><span>{formattedDate(saved.updatedAt)}</span></div></div>

          <div className="admin-feedback-area" aria-live="polite" aria-atomic="true">{notice && <div className="admin-feedback admin-feedback-success" role="status"><Icon name="check" /><span>{notice}</span><button className="admin-icon-button" type="button" onClick={() => setNotice("")} aria-label="Dismiss notification"><Icon name="close" /></button></div>}</div>
          {error && <div className="admin-feedback admin-feedback-error" role="alert"><Icon name="alert" /><span>{error}</span></div>}
          {conflict && <section className="admin-conflict" aria-labelledby="conflict-title"><h2 id="conflict-title">Keep your draft before loading another version.</h2><p>Download or copy these edits for safekeeping. Loading the latest saved content replaces the draft in this editor.</p><div className="admin-inline-actions"><button className="admin-button admin-button-dark" type="button" onClick={downloadDraft}><Icon name="download" /> Download draft</button><button className="admin-button admin-button-outline" type="button" onClick={() => void copyDraft()}>Copy draft</button><button className="admin-button admin-button-outline" type="button" onClick={reloadLatest} disabled={isBusy}>{pending === "reload" ? "Loading…" : "Load latest version"}</button></div></section>}

          {view === "history" ? (
            <section className="admin-history-panel" aria-labelledby="history-title">
              <div className="admin-section-heading"><div><span className="admin-eyebrow">Your safety net</span><h2 id="history-title">Version history</h2></div><a className="admin-button admin-button-outline" href="/api/cms/export" download><Icon name="download" /> Export saved content</a></div>
              <p className="admin-section-description">The latest 20 stored versions. Restoring a version replaces all saved text and contact details, and creates a new revision.</p>
              {saved.history.length ? <ol className="admin-history-list">{[...saved.history].sort((a, b) => b.revision - a.revision).slice(0, 20).map((item) => <li key={item.revision}><span className={`admin-history-icon ${item.revision === saved.revision ? "is-current" : ""}`}><Icon name={item.revision === saved.revision ? "check" : "history"} /></span><div><strong>Revision {item.revision}{item.revision === saved.revision && <span className="admin-current-tag">Current</span>}</strong><span>{formattedDate(item.updatedAt)}</span></div><button type="button" className="admin-button admin-button-outline" disabled={isBusy || conflict || item.revision === saved.revision} onClick={() => restoreRevision(item.revision)}>{item.revision === saved.revision ? "Current version" : pending === "restore" ? "Restoring…" : "Restore version"}</button></li>)}</ol> : <div className="admin-empty-state"><Icon name="history" /><h3>Your history starts here.</h3><p>Saved revisions will appear here after your first content update.</p></div>}
              <div className="admin-history-footer"><button className="admin-text-button" type="button" onClick={() => setView("content")}>← Back to content editor</button><button className="admin-text-button" type="button" disabled={isBusy} onClick={reloadLatest}><Icon name="reset" /> Refresh saved versions</button></div>
            </section>
          ) : (
            <>
              <div className="admin-editor-toolbar"><div><label className="admin-sr-only" htmlFor="admin-search">Find text, headings, or descriptions</label><Icon name="search" /><input ref={searchInput} id="admin-search" type="search" placeholder="Find text, headings, or descriptions…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><label className="admin-search-scope"><span className="admin-sr-only">Search scope</span><select value={searchScope} onChange={(event) => setSearchScope(event.target.value as "site" | "section")}><option value="site">Entire website</option><option value="section">This section</option></select></label></div>
              <div className="admin-content-layout"><div className="admin-content-column">
                <div className="admin-selected-section"><div><span className="admin-eyebrow">{searchTerm ? "SEARCH RESULTS" : currentPage ? "PAGE CONTENT" : "SHARED CONTENT"}</span><h2>{searchTerm ? `Results for “${query.trim()}”` : currentName}</h2>{currentPage && !searchTerm && <span className="admin-route">{currentPage.route}</span>}</div><span className="admin-count">{resultCount} {resultCount === 1 ? "field" : "fields"}</span></div>
                {!resultCount && <div className="admin-empty-state"><Icon name="search" /><h3>No matching content.</h3><p>Try a shorter phrase, or search the entire website.</p><button type="button" className="admin-button admin-button-outline" onClick={() => { setQuery(""); searchInput.current?.focus(); }}>Clear search</button></div>}
                {renderContacts()}
                {metadataFields.length > 0 && <section className="admin-section" aria-labelledby="metadata-section-title"><div className="admin-section-heading"><div><span className="admin-eyebrow">First impressions</span><h2 id="metadata-section-title">Page title & search description</h2></div><span className="admin-section-symbol" aria-hidden="true">Aa</span></div><p className="admin-section-description">The title and description used by browsers and search engines. Search engines may choose different text.</p><div className="admin-fields">{metadataFields.map((field, index) => renderField(field, index))}</div></section>}
                {copyFields.length > 0 && <section className="admin-section" aria-labelledby="copy-section-title"><div className="admin-section-heading"><div><span className="admin-eyebrow">Make it yours</span><h2 id="copy-section-title">{searchAll ? "Website copy" : currentPage ? "On-page content" : "Shared website copy"}</h2></div><Icon name="file" /></div><p className="admin-section-description">Edit the text below. Page layouts, images and links stay managed separately.</p><div className="admin-fields">{copyFields.map((field, index) => <Fragment key={field.id}>{renderField(field, index)}</Fragment>)}</div></section>}
              </div><aside className="admin-guidance" aria-label="Editing guidance"><div className="admin-guidance-card"><span className="admin-guidance-mark" aria-hidden="true">↗</span><span className="admin-eyebrow">A LITTLE GUIDANCE</span><h3>Small changes.<br />Clearer stories.</h3><p>Keep your message direct and helpful. Write for the people you want to reach.</p><div className="admin-guidance-divider" /><h4>Save, then preview.</h4><p>Preview opens the saved website in a new tab. Unsaved edits only appear here.</p><h4>Plain text, by design.</h4><p>Use words and line breaks, not HTML. Restoring original text also restores its original formatting.</p><span className="admin-guidance-footer"><Icon name="lock" /> Only the owner can edit.</span></div><div className="admin-backup-card"><Icon name="download" /><div><h4>Keep a copy</h4><p>Download saved content or a backup of your current draft.</p></div><a className="admin-text-button" href="/api/cms/export" download>Export saved content <span aria-hidden="true">↗</span></a><button type="button" className="admin-text-button" onClick={downloadDraft}>Download current draft <span aria-hidden="true">↗</span></button></div></aside></div>
            </>
          )}
        </main>

        <footer className="admin-savebar"><div className={`admin-save-status ${dirty || conflict ? "has-changes" : ""}`}><span className="admin-save-indicator">{dirty || conflict ? <span /> : <Icon name="check" />}</span><div><strong>{isBusy ? pending === "save" ? "Saving your changes…" : pending === "restore" ? "Restoring saved content…" : "Loading saved content…" : conflict ? "Latest version needs loading" : dirty ? `${changeCount} unsaved ${changeCount === 1 ? "change" : "changes"}` : "All changes saved"}</strong><span>{conflict ? "Keep your draft before loading the latest saved content." : dirty ? "Changes are kept here until you save." : `Revision ${saved.revision} · ${formattedDate(saved.updatedAt)}`}</span></div></div><div className="admin-save-actions"><button className="admin-button admin-discard-button" type="button" disabled={!dirty || isBusy} onClick={discardDraft}>Discard changes</button><button className="admin-button admin-button-primary" type="button" disabled={!dirty || isBusy || conflict} onClick={() => void requestState("save")}><Icon name={pending === "save" ? "reset" : "save"} className={pending === "save" ? "admin-spin" : ""} />{pending === "save" ? "Saving…" : "Save changes"}</button></div></footer>
      </div>
    </div>
  );
}
