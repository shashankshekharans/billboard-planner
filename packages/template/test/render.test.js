import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPlan, scriptSafeJson } from "../index.js";

const dataOf = html => JSON.parse(html.match(/<script id="plan-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test("injects the plan data and title into the template", () => {
  const plan = { title: "My Plan", sites: [{ location: "A" }] };
  const html = renderPlan(plan);
  assert.ok(!html.includes("__PLAN_DATA__"));
  assert.ok(!html.includes("__PLAN_TITLE__"));
  assert.match(html, /<title>My Plan<\/title>/);
  assert.deepEqual(dataOf(html), plan);
});

test("text that could break out of the script tag stays data", () => {
  const plan = { title: "<b>Q&A</b>", sites: [{ location: "</script><script>alert(1)</script>", notes: "<!-- x" }] };
  const html = renderPlan(plan);
  assert.equal(html.match(/<\/script>/g).length, renderPlan({ title: "x" }).match(/<\/script>/g).length);
  assert.match(html, /<title>&lt;b&gt;Q&amp;A&lt;\/b&gt;<\/title>/);
  assert.deepEqual(dataOf(html), plan);
});

test("line and paragraph separators are escaped", () => {
  assert.equal(scriptSafeJson({ t: "a\u2028b\u2029c" }), '{"t":"a\\u2028b\\u2029c"}');
});

test("rejects a template without exactly one placeholder", () => {
  assert.throws(() => renderPlan({}, "<html></html>"), /__PLAN_TITLE__ exactly once/);
  assert.throws(() => renderPlan({}, "__PLAN_TITLE__ __PLAN_DATA__ __PLAN_DATA__"), /__PLAN_DATA__ exactly once/);
});
