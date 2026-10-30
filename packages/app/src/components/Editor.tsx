import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { buildPage, download, fileName, importSites, OpenError, type PageResult, type Workspace } from "../workspace";
import { PlanForm } from "./PlanForm";
import { SitesForm } from "./SitesForm";

interface Props {
  ws?: Workspace;
  readOnly?: boolean;
  exampleTitle?: string;
  error?: string;
  /** Apply an edit to the newest version of the plan. */
  onChange: (edit: (ws: Workspace) => Workspace) => void;
  onHome: () => void;
  onOpen: (files: File[]) => void;
  onNew: () => void;
  onExample?: () => void;
  onDuplicate?: () => void;
  onSay?: (msg: string) => void;
}

const ACCEPT = ".xlsx,.xls,.csv,.yaml,.yml,.json,.html,.htm,image/*";

export function Editor(props: Props) {
  const { ws, readOnly } = props;
  const [tab, setTab] = useState<"plan" | "sites">("sites");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [page, setPage] = useState<PageResult>({ issues: [], warnings: [] });
  const lastGood = useRef<string>();
  const openInput = useRef<HTMLInputElement>(null);

  // Rebuild the preview shortly after each change
  useEffect(() => {
    if (!ws) return;
    const t = setTimeout(() => {
      const r = buildPage(ws);
      if (r.html) lastGood.current = r.html;
      setPage(r);
    }, readOnly ? 0 : 350);
    return () => clearTimeout(t);
  }, [ws, readOnly]);

  const money = useMemo(() => {
    const p = page.plan;
    try { return new Intl.NumberFormat(p?.locale ?? "en-IN", { style: "currency", currency: p?.currency ?? "INR", maximumFractionDigits: 0 }); }
    catch { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }); }
  }, [page.plan]);

  const exportPage = () => {
    if (!page.html || !ws) return;
    download(fileName(ws.file.plan.title), page.html);
    props.onSay?.("Downloaded. Open it in a browser, or send the file. You can open it here again to edit.");
  };

  const html = page.html ?? lastGood.current;
  const siteCount = ws?.file.sites.length ?? 0;

  return (
    <>
      <header class="bar">
        <a class="brand" href="#" onClick={e => { e.preventDefault(); props.onHome(); }}>
          <img src="favicon.svg" alt="" />
          <b>Billboard Planner</b>
        </a>
        <div class="actions">
          {readOnly ? (
            <>
              <button class="btn" type="button" onClick={props.onNew}>Start a new plan</button>
              <button class="btn" type="button" onClick={() => openInput.current?.click()}>Open a plan file</button>
            </>
          ) : (
            <>
              <button class="btn quiet" type="button" onClick={props.onExample}>View example</button>
              <button class="btn quiet" type="button" onClick={props.onNew}>New plan</button>
              <button class="btn" type="button" onClick={() => openInput.current?.click()}>Open…</button>
              <button class="btn primary" type="button" onClick={exportPage} disabled={!page.html}>Download page</button>
            </>
          )}
        </div>
        <input
          ref={openInput} type="file" multiple accept={ACCEPT} class="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={e => { const files = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ""; if (files.length) props.onOpen(files); }}
        />
      </header>

      {readOnly && (
        <div class="banner" role="note">
          <p>This is an example plan. Duplicate it to edit.</p>
          <button class="btn primary" type="button" onClick={props.onDuplicate} disabled={!ws}>Duplicate as my plan</button>
        </div>
      )}

      {!readOnly && (
        <div class="mobile-switch" role="group" aria-label="Show">
          <button class={`btn ${view === "edit" ? "primary" : ""}`} type="button" aria-pressed={view === "edit"} onClick={() => setView("edit")}>Edit</button>
          <button class={`btn ${view === "preview" ? "primary" : ""}`} type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}>Preview</button>
        </div>
      )}

      <main class={`workspace ${readOnly ? "full" : ""}`} data-view={view}>
        {!readOnly && ws && (
          <aside class="panel" aria-label="Edit plan">
            <div class="tabs" role="tablist">
              <button role="tab" type="button" aria-selected={tab === "sites"} onClick={() => setTab("sites")}>Sites<span class="count">{siteCount}</span></button>
              <button role="tab" type="button" aria-selected={tab === "plan"} onClick={() => setTab("plan")}>Plan details</button>
            </div>
            <div class="panel-body" role="tabpanel">
              <Checks page={page} money={money} />
              {tab === "plan"
                ? <PlanForm ws={ws} onChange={props.onChange} />
                : <SitesForm
                    ws={ws} onChange={props.onChange}
                    onImport={async f => {
                      try {
                        const r = await importSites(ws, f);
                        props.onChange(() => r.ws);
                        props.onSay?.(`Added ${r.ws.file.sites.length - ws.file.sites.length} sites from ${f.name}.` + (r.warnings.length ? ` ${r.warnings[0]}` : ""));
                      } catch (e) { props.onSay?.(e instanceof OpenError ? e.message : `${f.name} could not be read.`); }
                    }}
                  />}
            </div>
          </aside>
        )}
        <section class="preview" aria-label="Preview of the plan page">
          {props.error && !ws ? (
            <div class="empty" role="alert"><b>The example could not be loaded</b><span>{props.error}</span></div>
          ) : !ws ? (
            <div class="empty" role="status"><b>Loading {props.exampleTitle ?? "the example"}…</b></div>
          ) : html ? (
            <iframe title="Plan page preview" srcdoc={html} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" />
          ) : (
            <div class="empty">
              <b>{siteCount ? "Fix the items under Checks to see the page" : "Add your first site"}</b>
              <span>{siteCount ? "The preview appears as soon as the plan is complete." : "Give it a location, coordinates, a size and a monthly rate. The map appears here."}</span>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Checks({ page, money }: { page: PageResult; money: Intl.NumberFormat }) {
  const t = page.totals;
  return (
    <section class="problems" aria-label="Checks" aria-live="polite">
      {t && (
        <div class="totals">
          <span><b>{t.count}</b> sites</span>
          <span><b>{t.area.toLocaleString(page.plan?.locale)}</b> sq ft</span>
          <span>Rent <b>{money.format(t.rate)}</b>/month</span>
          <span>Total <b>{money.format(t.total)}{t.open ? "*" : ""}</b></span>
        </div>
      )}
      {page.issues.map(i => <p class="issue" key={i}>{i}</p>)}
      {page.warnings.map(w => <p class="warning" key={w}>{w}</p>)}
    </section>
  );
}
