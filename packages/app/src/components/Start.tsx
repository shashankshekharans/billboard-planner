import { useRef } from "preact/hooks";
import type { Workspace } from "../workspace";

// Road-sign direction arrow: thick stem, triangular head. `turn` rotates it like the arrows on a gantry.
const Arrow = ({ turn }: { turn: number }) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}>
    <path d="M20 3 L35 19 H25.5 V37 H14.5 V19 H5 Z" fill="#fff" />
  </svg>
);

const ACCEPT = ".xlsx,.xls,.csv,.yaml,.yml,.json,.html,.htm,image/*";

export function Start(props: {
  exampleTitle?: string; saved?: Workspace; error?: string;
  onExample: () => void; onNew: () => void; onOpen: (files: File[]) => void; onContinue: () => void; onForget: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const saved = props.saved;
  const when = saved?.savedAt ? new Date(saved.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <main class="start">
      <div class="gantry">
        <section class="sign" aria-labelledby="app-title">
          <div class="sign-inner">
            <div class="sign-head">
              <h1 id="app-title">Billboard Planner</h1>
              <p>See every billboard before you book it</p>
            </div>
            <nav class="lanes" aria-label="Get started">
              <button class="lane" type="button" onClick={props.onExample}>
                <Arrow turn={0} />
                <strong>View example</strong>
                <span>{props.exampleTitle ?? "AAJ Swift – NH-48 Billboard Plan"}: eight boards on the Delhi–Jaipur Highway</span>
              </button>
              <button class="lane" type="button" onClick={props.onNew}>
                <Arrow turn={45} />
                <strong>Start a new plan</strong>
                <span>Add sites, photos and rates yourself</span>
              </button>
              <button class="lane" type="button" onClick={() => fileInput.current?.click()}>
                <Arrow turn={90} />
                <strong>Open a plan file</strong>
                <span>A vendor sheet (.xlsx, .csv), a plan.yaml or a page you downloaded. Select its photos too.</span>
              </button>
            </nav>
          </div>
        </section>
        <div class="posts" aria-hidden="true"><i /><i /></div>
      </div>
      <input
        ref={fileInput} type="file" multiple accept={ACCEPT} class="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={e => { const files = [...(e.currentTarget.files ?? [])]; e.currentTarget.value = ""; if (files.length) props.onOpen(files); }}
      />
      {props.error && <p class="notice" role="alert">{props.error}</p>}
      <div class="start-foot">
        <p>
          Billboard Planner turns a vendor's list into one page: a satellite map with every board pinned, a card for each
          site with its photo and rate, and a costing table. Your plan stays in this browser until you download the page,
          a single HTML file you can email or send on WhatsApp.{" "}
          <a href="sites-template.xlsx" download>Download the spreadsheet template</a>
        </p>
        {saved && (
          <div class="continue">
            <div>
              <b>{saved.file.plan.title || "Untitled plan"}</b>
              <small>{saved.file.sites.length} site{saved.file.sites.length === 1 ? "" : "s"}{when && ` · saved ${when}`}</small>
            </div>
            <button class="btn primary" type="button" onClick={props.onContinue}>Continue your plan</button>
            <button class="btn quiet" type="button" onClick={() => { if (confirm("Remove the plan kept in this browser?")) props.onForget(); }}>Remove</button>
          </div>
        )}
      </div>
    </main>
  );
}
