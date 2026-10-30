import { useEffect, useRef, useState } from "preact/hooks";
import { forget, listExamples, loadExample, loadSaved, newWorkspace, openFiles, OpenError, save, type ExampleInfo, type Workspace } from "../workspace";
import { Editor } from "./Editor";
import { Start } from "./Start";

type Route = "start" | "example" | "edit";
const routeOf = (hash: string): Route => hash === "#example" ? "example" : hash === "#edit" ? "edit" : "start";

/** Hash routes: "" start screen, #example the bundled example (read-only), #edit the user's plan. */
export function App() {
  const [route, setRoute] = useState<Route>(routeOf(location.hash));
  const [ws, setWs] = useState<Workspace | undefined>();
  const [saved, setSaved] = useState<Workspace | undefined>();
  const [example, setExample] = useState<Workspace | undefined>();
  const [exampleInfo, setExampleInfo] = useState<ExampleInfo | undefined>();
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<number>();
  const latest = useRef<Workspace | undefined>();   // the newest plan, so quick successive edits build on each other

  const go = (r: Route) => { location.hash = r === "start" ? "" : r; setRoute(r); window.scrollTo(0, 0); };
  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(t => t === msg ? undefined : t), 4000); };

  useEffect(() => {
    const onHash = () => setRoute(routeOf(location.hash));
    addEventListener("hashchange", onHash);
    (async () => {
      const s = await loadSaved();
      setSaved(s);
      if (s) { setWs(s); latest.current = s; }
      try {
        const list = await listExamples();
        setExampleInfo(list.find(e => e.default) ?? list[0]);
      } catch (e) { setError((e as Error).message); }
      setReady(true);
    })();
    return () => removeEventListener("hashchange", onHash);
  }, []);

  // Load the example when it is shown
  useEffect(() => {
    if (route !== "example" || example || !exampleInfo) return;
    loadExample(exampleInfo).then(setExample, e => setError((e as Error).message));
  }, [route, exampleInfo, example]);

  // #edit with nothing to edit goes back to the start screen
  useEffect(() => { if (ready && route === "edit" && !ws) go("start"); }, [ready, route, ws]);

  // Autosave the user's plan in this browser
  const update = (next: Workspace) => {
    latest.current = next;
    setWs(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!(await save(next))) say("This plan is too large to keep in the browser. Download the page to keep your work.");
      else setSaved({ ...next, savedAt: Date.now() });
    }, 600);
  };
  const edit = (fn: (w: Workspace) => Workspace) => { if (latest.current) update(fn(latest.current)); };
  const start = (next: Workspace) => { update(next); go("edit"); };

  const open = async (files: File[]) => {
    setError(undefined);
    try {
      const { ws: opened, warnings } = await openFiles(files);
      start(opened);
      if (warnings.length) say(warnings[0]! + (warnings.length > 1 ? ` (and ${warnings.length - 1} more, listed under Checks)` : ""));
    } catch (e) {
      setError(e instanceof OpenError ? e.message : `That file could not be opened: ${(e as Error).message}`);
      go("start");
    }
  };

  const toastEl = toast && <div class="toast" role="status">{toast}</div>;

  if (route === "example") {
    return <>
      <Editor
        ws={example} readOnly onChange={() => {}}
        onHome={() => go("start")} onOpen={open} onNew={() => start(newWorkspace())}
        onDuplicate={() => { if (example) { start({ ...structuredClone(example), origin: "duplicate" }); say("Copied the example into your own plan. Your changes are kept in this browser."); } }}
        exampleTitle={exampleInfo?.title} error={error}
      />
      {toastEl}
    </>;
  }
  if (route === "edit" && ws) {
    return <>
      <Editor
        ws={ws} onChange={edit} onHome={() => go("start")} onOpen={open} onSay={say}
        onNew={() => { if (confirm("Start a new plan? Your current plan is replaced (download it first to keep it).")) start(newWorkspace()); }}
        onExample={() => go("example")}
      />
      {toastEl}
    </>;
  }
  return <>
    <Start
      exampleTitle={exampleInfo?.title} saved={saved} error={error}
      onExample={() => go("example")}
      onNew={() => { if (!saved || confirm("Start a new plan? The plan kept in this browser is replaced.")) start(newWorkspace()); }}
      onOpen={open}
      onContinue={() => { if (saved) { setWs(saved); latest.current = saved; go("edit"); } }}
      onForget={async () => { await forget(); setSaved(undefined); setWs(undefined); latest.current = undefined; }}
    />
    {toastEl}
  </>;
}
