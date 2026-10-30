import { GROUP_PALETTE } from "@billboard-planner/core";
import { logoDataUrl, LOGO_HEIGHT } from "../images";
import { imageFor, type BaseDraft, type PlanDraft, type Workspace } from "../workspace";
import { Color, Coords, ImagePick, Text } from "./fields";

type Rings = NonNullable<PlanDraft["rings"]>;
type Patch<T> = Partial<T> | ((current: T) => Partial<T>);
const apply = <T,>(patch: Patch<T>, current: T) => typeof patch === "function" ? patch(current) : patch;

// Every change is applied to the newest plan (onChange takes an updater), so quick edits never overwrite each other.
export function PlanForm({ ws, onChange }: { ws: Workspace; onChange: (edit: (ws: Workspace) => Workspace) => void }) {
  const p = ws.file.plan;
  const base: BaseDraft | undefined = p.bases?.[0];
  const rings = p.rings;

  const setPlan = (patch: Patch<PlanDraft>) =>
    onChange(w => ({ ...w, file: { ...w.file, plan: { ...w.file.plan, ...apply(patch, w.file.plan) } } }));
  const setBase = (patch: Partial<BaseDraft> | null) => setPlan(pl => ({
    bases: patch === null ? [] : [{ id: "base", name: "", distance_from: true, ...pl.bases?.[0], ...patch }, ...(pl.bases ?? []).slice(1)]
  }));
  const setRings = (patch: Patch<Rings> | null) => setPlan(pl => {
    const current: Rings = { center: {}, radii_km: [20, 50], visible: true, ...pl.rings };
    return { rings: patch === null ? undefined : { ...current, ...apply(patch, current) } };
  });
  const setGroup = (i: number, patch: Partial<PlanDraft["groups"][number]>) =>
    setPlan(pl => ({ groups: pl.groups.map((g, k) => k === i ? { ...g, ...patch } : g) }));
  // Store an uploaded logo and point the plan at it, in one edit
  const addLogo = async (f: File, height: number, point: (pl: PlanDraft, key: string) => Partial<PlanDraft>) => {
    const key = `logos/${f.name}`;
    const uri = await logoDataUrl(f, height);
    onChange(w => ({ ...w, images: { ...w.images, [key]: uri }, file: { ...w.file, plan: { ...w.file.plan, ...point(w.file.plan, key) } } }));
  };

  return (
    <>
      <fieldset>
        <legend>Page</legend>
        <Text label="Title" value={p.title} onInput={v => setPlan({ title: v })} placeholder="Billboard Plan" />
        <Text label="Subtitle" value={p.subtitle} onInput={v => setPlan({ subtitle: v })} placeholder="NH-48 corridor · Delhi Jaipur Highway"
          hint={<small>Put **double stars** around words to make them bold.</small>} />
        <ImagePick label="Logo" src={imageFor(ws, p.logo)} hint="PNG with a transparent background works best."
          onPick={f => addLogo(f, LOGO_HEIGHT.header, (_pl, key) => ({ logo: key }))}
          onRemove={() => setPlan({ logo: undefined })} />
        <div class="row">
          <Text label="Currency" value={p.currency} onInput={v => setPlan({ currency: v.toUpperCase() })} placeholder="INR" />
          <Text label="Number format" value={p.locale} onInput={v => setPlan({ locale: v })} placeholder="en-IN" />
          <Color label="Brand colour" value={p.brand?.primary ?? "#c1202d"} onInput={v => setPlan(pl => ({ brand: { ...pl.brand, primary: v } }))} />
        </div>
        <label class="check">
          <input type="checkbox" checked={p.map?.default_view === "road"}
            onChange={e => { const road = e.currentTarget.checked; setPlan(pl => ({ map: { ...pl.map, default_view: road ? "road" : "satellite" } })); }} />
          Open on the road map instead of satellite
        </label>
      </fieldset>

      <fieldset>
        <legend>Groups</legend>
        <p class="hint">Routes or areas. Each has its own pin colour, and the table totals them separately.</p>
        {p.groups.map((g, i) => {
          const used = ws.file.sites.some(s => s.group === g.id);
          return (
            <div class="group-row" key={g.id}>
              <input type="color" aria-label={`${g.name} colour`} value={/^#[0-9a-f]{6}$/i.test(g.color) ? g.color : "#0f6b3e"}
                onInput={e => setGroup(i, { color: e.currentTarget.value, soft: undefined })}
                style={{ width: "38px", height: "34px", padding: "2px", border: "1px solid var(--line)", borderRadius: "6px" }} />
              <label class="field"><span class="sr-only">Group name</span>
                <input type="text" value={g.name} onInput={e => setGroup(i, { name: e.currentTarget.value })} />
              </label>
              <button class="btn quiet danger" type="button" disabled={p.groups.length === 1 || used}
                title={used ? "Move its sites to another group first" : "Remove group"}
                onClick={() => setPlan(pl => ({ groups: pl.groups.filter((_, k) => k !== i) }))}>Remove</button>
            </div>
          );
        })}
        <div><button class="btn" type="button" onClick={() => setPlan(pl => {
          let n = pl.groups.length + 1, id = `group-${n}`;
          while (pl.groups.some(g => g.id === id)) id = `group-${++n}`;
          return { groups: [...pl.groups, { id, name: `Group ${n}`, color: GROUP_PALETTE[pl.groups.length % GROUP_PALETTE.length]! }] };
        })}>Add group</button></div>
      </fieldset>

      <fieldset>
        <legend>Your base</legend>
        <p class="hint">Your warehouse, store or office. Each site shows its distance from here.</p>
        {base ? (
          <>
            <Text label="Name" value={base.name} onInput={v => setBase({ name: v })} placeholder="AAJ Swift Warehouse" />
            <Coords label="Coordinates" value={base.coords} onInput={v => setBase({ coords: v })} />
            <Text label="Short word for it" value={base.label} onInput={v => setBase({ label: v || undefined })} placeholder="warehouse"
              hint={<small>Used as "From our warehouse" on cards and "From warehouse" in the table.</small>} />
            <ImagePick label="Map marker logo" src={imageFor(ws, base.marker_logo)} hint="A small square logo works best."
              onPick={f => addLogo(f, LOGO_HEIGHT.marker, (pl, key) => ({ bases: [{ ...pl.bases![0]!, marker_logo: key }, ...pl.bases!.slice(1)] }))}
              onRemove={() => setBase({ marker_logo: undefined })} />
            <div><button class="btn quiet danger" type="button" onClick={() => setBase(null)}>Remove base</button></div>
          </>
        ) : <div><button class="btn" type="button" onClick={() => setBase({ name: "", coords: "" })}>Add your base</button></div>}
      </fieldset>

      <fieldset>
        <legend>Radius rings</legend>
        <p class="hint">Dotted circles to see coverage, for example 20 km and 50 km from a city centre.</p>
        {rings ? (
          <>
            {base && (
              <label class="check">
                <input type="checkbox" checked={!!rings.center.base}
                  onChange={e => { const onBase = e.currentTarget.checked; setRings({ center: onBase ? { base: "base" } : { coords: "", label: "" } }); }} />
                Centre the rings on your base
              </label>
            )}
            {!rings.center.base && <>
              <Coords label="Centre" value={rings.center.coords} onInput={v => setRings(r => ({ center: { ...r.center, coords: v } }))} />
              <Text label="Name of the centre" value={rings.center.label} onInput={v => setRings(r => ({ center: { ...r.center, label: v } }))} placeholder="Gurgaon" />
            </>}
            <Text label="Radii in km" value={rings.radii_km.join(", ")} placeholder="20, 50"
              onInput={v => setRings({ radii_km: v.split(/[,;\s]+/).filter(Boolean).map(Number).filter(n => n > 0) })} />
            <label class="check">
              <input type="checkbox" checked={rings.visible !== false} onChange={e => { const visible = e.currentTarget.checked; setRings({ visible }); }} />
              Show rings when the page opens
            </label>
            <div><button class="btn quiet danger" type="button" onClick={() => setRings(null)}>Remove rings</button></div>
          </>
        ) : <div><button class="btn" type="button" onClick={() => setRings(base ? { center: { base: "base" } } : {})}>Add rings</button></div>}
      </fieldset>

      <fieldset>
        <legend>Cities</legend>
        <p class="hint">Blue markers with a name label, to help people find their way around the map.</p>
        {(p.cities ?? []).map((c, i) => (
          <div class="city-row" key={i}>
            <Text label="City name" value={c.name} placeholder="Manesar"
              onInput={v => setPlan(pl => ({ cities: (pl.cities ?? []).map((x, k) => k === i ? { ...x, name: v } : x) }))} />
            <Coords label="Coordinates" value={c.coords}
              onInput={v => setPlan(pl => ({ cities: (pl.cities ?? []).map((x, k) => k === i ? { ...x, coords: v } : x) }))} />
            <div><button class="btn quiet danger" type="button" onClick={() => setPlan(pl => ({ cities: (pl.cities ?? []).filter((_, k) => k !== i) }))}>Remove city</button></div>
          </div>
        ))}
        <div><button class="btn" type="button" onClick={() => setPlan(pl => ({ cities: [...(pl.cities ?? []), { name: "", coords: "" }] }))}>Add city</button></div>
      </fieldset>

      <fieldset>
        <legend>Notes under the table</legend>
        <label class="field"><span>One note per line</span>
          <textarea value={(p.notes ?? []).join("\n")} placeholder="Printing & mounting is a one-time charge."
            onInput={e => setPlan({ notes: e.currentTarget.value.split("\n") })}
            onBlur={e => setPlan({ notes: e.currentTarget.value.split("\n").map(t => t.trim()).filter(Boolean) })} />
        </label>
      </fieldset>
    </>
  );
}
