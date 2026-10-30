import type { ComponentChildren } from "preact";
import { useId, useRef } from "preact/hooks";
import { checkCoords } from "../workspace";

export function Text(props: { label: string; value?: string; onInput: (v: string) => void; placeholder?: string; hint?: ComponentChildren; required?: boolean }) {
  const id = useId();
  return (
    <label class="field" for={id}>
      <span>{props.label}</span>
      <input id={id} type="text" value={props.value ?? ""} placeholder={props.placeholder} required={props.required}
        onInput={e => props.onInput(e.currentTarget.value)} />
      {props.hint}
    </label>
  );
}

/** A number field that stores undefined when empty. */
export function Num(props: { label: string; value?: number; onInput: (v: number | undefined) => void; min?: number; step?: string; placeholder?: string }) {
  const id = useId();
  return (
    <label class="field" for={id}>
      <span>{props.label}</span>
      <input id={id} type="number" inputMode="decimal" min={props.min ?? 0} step={props.step ?? "any"} value={props.value ?? ""} placeholder={props.placeholder}
        onInput={e => { const v = e.currentTarget.value; props.onInput(v === "" ? undefined : Number(v)); }} />
    </label>
  );
}

export function Coords(props: { label: string; value?: string; onInput: (v: string) => void }) {
  const c = checkCoords(props.value);
  return (
    <Text label={props.label} value={props.value} onInput={props.onInput} placeholder="28.135394, 76.650181 or Lat 28°10'58&quot;N, Long 76°43'3&quot;E"
      hint={c && (c.ok
        ? <small class="ok">Reads as {c.lat.toFixed(6)}, {c.lng.toFixed(6)}</small>
        : <small class="bad">{c.message}</small>)} />
  );
}

export function Color(props: { label: string; value?: string; onInput: (v: string) => void }) {
  const id = useId();
  return (
    <div class="field">
      <label for={id}><span>{props.label}</span></label>
      <div class="color">
        <input type="color" aria-label={`${props.label} picker`} value={/^#[0-9a-f]{6}$/i.test(props.value ?? "") ? props.value : "#0f6b3e"} onInput={e => props.onInput(e.currentTarget.value)} />
        <input id={id} type="text" value={props.value ?? ""} onInput={e => props.onInput(e.currentTarget.value)} style={{ maxWidth: "110px" }} />
      </div>
    </div>
  );
}

/** Pick an image file; shows the current image. */
export function ImagePick(props: { label: string; src?: string; onPick: (f: File) => void; onRemove?: () => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div class="field">
      <span>{props.label}</span>
      <div class="image-field">
        {props.src && <img src={props.src} alt="" />}
        <button class="btn" type="button" onClick={() => input.current?.click()}>{props.src ? "Replace" : "Add image"}</button>
        {props.src && props.onRemove && <button class="btn quiet danger" type="button" onClick={props.onRemove}>Remove</button>}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only" tabIndex={-1} aria-label={props.label}
          onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) props.onPick(f); }} />
      </div>
      {props.hint && <small>{props.hint}</small>}
    </div>
  );
}
