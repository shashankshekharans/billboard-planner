import { useRef, useState } from "preact/hooks";
import { photoDataUrl } from "../images";
import { imageFor, nextId, type SiteDraft, type Workspace } from "../workspace";
import { Coords, Num, Text } from "./fields";

type Edit = (edit: (ws: Workspace) => Workspace) => void;
type SitePatch = Partial<SiteDraft> | ((s: SiteDraft) => Partial<SiteDraft>);

// Every change is applied to the newest plan (onChange takes an updater), so quick edits never overwrite each other.
export function SitesForm({ ws, onChange, onImport }: { ws: Workspace; onChange: Edit; onImport: (f: File) => void }) {
  const sites = ws.file.sites;
  const groups = ws.file.plan.groups;
  const [open, setOpen] = useState<number | undefined>();
  const importInput = useRef<HTMLInputElement>(null);

  const setSites = (fn: (sites: SiteDraft[]) => SiteDraft[]) => onChange(w => ({ ...w, file: { ...w.file, sites: fn(w.file.sites) } }));
  const setSite = (i: number, patch: SitePatch) =>
    setSites(ss => ss.map((s, k) => k === i ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s));
  const add = () => {
    setSites(ss => [...ss, { id: String(nextId(ss)), group: groups[groups.length - 1]?.id ?? "sites", qty: 1, days: 30, printing: "tbc", photos: [] }]);
    setOpen(sites.length);
  };
  const addPhotos = async (i: number, siteId: string, files: File[]) => {
    const added: Record<string, string> = {};
    for (const f of files) {
      try { added[`photos/${siteId}-${Date.now().toString(36)}-${f.name}`] = await photoDataUrl(f); }
      catch { alert(`${f.name} could not be read as an image.`); }
    }
    onChange(w => ({
      ...w, images: { ...w.images, ...added },
      file: { ...w.file, sites: w.file.sites.map((s, k) => k === i ? { ...s, photos: [...(s.photos ?? []), ...Object.keys(added)] } : s) }
    }));
  };

  const actions = (
    <div class="list-actions">
      <button class="btn primary" type="button" onClick={add}>Add a site</button>
      <button class="btn" type="button" onClick={() => importInput.current?.click()}>Import from spreadsheet</button>
    </div>
  );

  return (
    <section class="sites" aria-label="Sites">
      {sites.length === 0 ? (
        <div class="empty-sites">
          <span>No sites yet. Add them one by one, or import the vendor's spreadsheet.</span>
          {actions}
        </div>
      ) : (
        <>
          {sites.map((s, i) => (
            <SiteItem key={i} ws={ws} site={s} n={i + 1} open={open === i}
              onToggle={o => setOpen(o ? i : undefined)}
              onChange={patch => setSite(i, patch)}
              onAddPhotos={files => addPhotos(i, s.id, files)}
              onDuplicate={() => { setSites(ss => [...ss.slice(0, i + 1), { ...structuredClone(ss[i]!), id: String(nextId(ss)) }, ...ss.slice(i + 1)]); setOpen(i + 1); }}
              onDelete={() => { if (confirm(`Delete site ${i + 1}${s.location ? ` (${s.location})` : ""}?`)) { setSites(ss => ss.filter((_, k) => k !== i)); setOpen(undefined); } }}
              onMove={d => {
                const j = i + d;
                if (j < 0 || j >= sites.length) return;
                setSites(ss => { const next = [...ss]; [next[i], next[j]] = [next[j]!, next[i]!]; return next; });
                setOpen(j);
              }}
            />
          ))}
          {actions}
          <p class="hint">Pins are numbered in this order. Groups and their colours are under Plan details.</p>
        </>
      )}
      <input ref={importInput} type="file" accept=".xlsx,.xls,.csv" class="sr-only" tabIndex={-1} aria-label="Import sites from a spreadsheet"
        onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) onImport(f); }} />
    </section>
  );
}

function SiteItem(props: {
  ws: Workspace; site: SiteDraft; n: number; open: boolean;
  onToggle: (open: boolean) => void; onChange: (patch: SitePatch) => void; onAddPhotos: (files: File[]) => Promise<void>;
  onDuplicate: () => void; onDelete: () => void; onMove: (d: -1 | 1) => void;
}) {
  const { ws, site: s, n } = props;
  const groups = ws.file.plan.groups;
  const group = groups.find(g => g.id === s.group);
  const photoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const printingKind = typeof s.printing === "number" ? "amount" : s.printing ?? "tbc";

  return (
    <details class="site" open={props.open} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== props.open) props.onToggle(o); }}>
      <summary>
        <span class="pin-no" style={{ background: group?.color ?? "#5d6b63" }}>{n}</span>
        <span class="loc">{s.location || "New site"}</span>
        <small>{s.width_ft && s.height_ft ? `${s.width_ft} × ${s.height_ft} ft` : ""}</small>
      </summary>
      {props.open && (
        <div class="site-body">
          <div class="row">
            <Text label="Site ID" value={s.id} onInput={v => props.onChange({ id: v })} />
            <label class="field"><span>Group</span>
              <select value={s.group} onChange={e => props.onChange({ group: e.currentTarget.value })}>
                {groups.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}
                {!group && <option value={s.group}>{s.group} (missing)</option>}
              </select>
            </label>
          </div>
          <Text label="Location" value={s.location} onInput={v => props.onChange({ location: v })} placeholder="Delhi Rd. Kasola Chowk Before Flyover" />
          <Coords label="Coordinates" value={s.coords} onInput={v => props.onChange({ coords: v })} />
          <div class="row">
            <Text label="Media vehicle" value={s.media_vehicle} onInput={v => props.onChange({ media_vehicle: v })} placeholder="Hoarding" />
            <Text label="Facing" value={s.facing} onInput={v => props.onChange({ facing: v })} placeholder="Jaipur" />
            <Text label="Illumination" value={s.illumination} onInput={v => props.onChange({ illumination: v })} placeholder="N/L" />
          </div>
          <div class="row">
            <Num label="Width (ft)" value={s.width_ft} onInput={v => props.onChange({ width_ft: v })} />
            <Num label="Height (ft)" value={s.height_ft} onInput={v => props.onChange({ height_ft: v })} />
            <Num label="Qty" value={s.qty} step="1" min={1} onInput={v => props.onChange({ qty: v })} />
          </div>
          <div class="row">
            <Num label="Rate / month" value={s.rate_per_month} onInput={v => props.onChange({ rate_per_month: v })} />
            <Num label="Days" value={s.days} step="1" min={1} onInput={v => props.onChange({ days: v })} />
          </div>
          <div class="row">
            <label class="field"><span>Printing & mounting</span>
              <select value={printingKind} onChange={e => {
                const k = e.currentTarget.value;
                props.onChange(cur => ({ printing: k === "amount" ? (typeof cur.printing === "number" ? cur.printing : 0) : k as "extra" | "tbc" }));
              }}>
                <option value="amount">Amount</option>
                <option value="extra">Extra</option>
                <option value="tbc">To be confirmed</option>
              </select>
            </label>
            {printingKind === "amount" && <Num label="Printing amount" value={s.printing as number} onInput={v => props.onChange({ printing: v ?? 0 })} />}
            <Text label="Tax note" value={s.tax_note} onInput={v => props.onChange({ tax_note: v })} placeholder="GST extra" />
          </div>
          <div class="field">
            <span>Photos</span>
            <div class="photos">
              {(s.photos ?? []).map((p, k) => {
                const src = imageFor(ws, p);
                return src ? (
                  <div class="photo" key={p}>
                    <img src={src} alt={`Photo ${k + 1}`} />
                    <button type="button" aria-label={`Remove photo ${k + 1}`} onClick={() => props.onChange(cur => ({ photos: (cur.photos ?? []).filter(x => x !== p) }))}>×</button>
                  </div>
                ) : <div class="photo missing" key={p} title={p}>{p.split("/").pop()} is missing</div>;
              })}
              <button class="btn" type="button" disabled={busy} onClick={() => photoInput.current?.click()}>{busy ? "Adding…" : "Add photos"}</button>
            </div>
            <input ref={photoInput} type="file" accept="image/*" multiple class="sr-only" tabIndex={-1} aria-label={`Photos for site ${n}`}
              onChange={async e => {
                const files = [...(e.currentTarget.files ?? [])];
                e.currentTarget.value = "";
                if (!files.length) return;
                setBusy(true);
                await props.onAddPhotos(files);
                setBusy(false);
              }} />
          </div>
          <div class="site-actions">
            <span>
              <button class="btn quiet" type="button" onClick={() => props.onMove(-1)} disabled={n === 1}>Move up</button>
              <button class="btn quiet" type="button" onClick={() => props.onMove(1)} disabled={n === ws.file.sites.length}>Move down</button>
            </span>
            <span>
              <button class="btn quiet" type="button" onClick={props.onDuplicate}>Duplicate</button>
              <button class="btn quiet danger" type="button" onClick={props.onDelete}>Delete</button>
            </span>
          </div>
        </div>
      )}
    </details>
  );
}
