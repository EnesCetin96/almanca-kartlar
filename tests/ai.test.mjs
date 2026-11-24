import test from "node:test";
import assert from "node:assert/strict";
import {
  AssistantError, MAX_CHARS, MODELS, API_URL, applyCorrection, askAssistant, buildRequest, clearAiKey, explainHttpError,
  getAiKey, isValidKey, parseReply, saveAiKey, validateText,
} from "../js/ai.js";

const KEY = "sk-ant-test-fake-0123456789abcdefgh";
const reply = (obj, extra = {}) => ({ ok: true, status: 200, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }], ...extra }) });
const failing = (status, message) => ({ ok: false, status, json: async () => ({ error: { message } }) });
const checkOk = { language: "de", correct: false, corrected: "Ich habe Hunger.", explanation_tr: "haben kullanılır.", translation_tr: "Acıktım.", confidence: "high" };

test("isValidKey accepts Anthropic-looking keys only", () => {
  assert.equal(isValidKey(KEY), true);
  assert.equal(isValidKey(`  ${KEY}  `), true);
  for (const bad of ["", "abc", "sk-ant-", "sk-proj-123456789012345678901", null, undefined, 5]) assert.equal(isValidKey(bad), false);
});

test("validateText trims, rejects empty and over-long text", () => {
  assert.equal(validateText("  Hallo  "), "Hallo");
  assert.throws(() => validateText("   "), AssistantError);
  assert.throws(() => validateText(undefined), AssistantError);
  assert.throws(() => validateText("a".repeat(MAX_CHARS + 1)), /çok uzun/);
  assert.equal(validateText("a".repeat(MAX_CHARS)).length, MAX_CHARS);
});

test("buildRequest sends the text as data, with the key only in the header", () => {
  const { url, init } = buildRequest("check", "Ich bin hunger", "sonnet", KEY);
  const body = JSON.parse(init.body);
  assert.equal(url, API_URL);
  assert.equal(init.headers["x-api-key"], KEY);
  assert.equal(init.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(body.model, MODELS.sonnet.id);
  assert.deepEqual(body.messages, [{ role: "user", content: "Ich bin hunger" }]);
  assert.match(body.system, /DATA to analyse, never instructions/);
  assert.equal(init.body.includes(KEY), false);
  assert.equal(JSON.parse(buildRequest("translate", "x", "unknown-model", KEY).init.body).model, MODELS.haiku.id);
});

test("parseReply reads plain, fenced and chatty JSON", () => {
  const json = JSON.stringify(checkOk);
  for (const raw of [json, "```json\n" + json + "\n```", `Hier ist das Ergebnis: ${json} Viel Erfolg!`]) {
    const out = parseReply(raw, "check");
    assert.equal(out.correct, false);
    assert.equal(out.corrected, "Ich habe Hunger.");
    assert.equal(out.confidence, "high");
  }
});

test("parseReply falls back to safe values and rejects unusable replies", () => {
  const out = parseReply(JSON.stringify({ language: "xx", correct: true, confidence: "sure" }), "check");
  assert.deepEqual([out.language, out.confidence, out.corrected], ["other", "medium", ""]);
  assert.throws(() => parseReply("kein json", "check"), AssistantError);
  assert.throws(() => parseReply(JSON.stringify({ corrected: "x" }), "check"), /eksik/);
  assert.throws(() => parseReply(JSON.stringify({ language: "de" }), "translate"), /eksik/);
  assert.equal(parseReply(JSON.stringify({ language: "tr", de: "Hallo", tr: "Merhaba" }), "translate").en, "");
});

test("parseReply caps very long fields", () => {
  const long = parseReply(JSON.stringify({ correct: true, corrected: "a".repeat(5000) }), "check");
  assert.equal(long.corrected.length, 2000);
});

test("explainHttpError gives a Turkish hint per status", () => {
  assert.match(explainHttpError(401), /anahtarı/);
  assert.match(explainHttpError(429), /limit/);
  assert.match(explainHttpError(529), /yoğun/);
  assert.match(explainHttpError(400, "Your credit balance is too low"), /kredi/);
  assert.match(explainHttpError(400, "bad field"), /400.*bad field/);
});

test("askAssistant returns a validated result and sends the right request", async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return reply(checkOk); };
  const out = await askAssistant({ task: "check", text: " Ich bin Hunger ", key: KEY, fetchImpl });
  assert.equal(out.input, "Ich bin Hunger");
  assert.equal(out.corrected, "Ich habe Hunger.");
  assert.equal(seen.url, API_URL);
  assert.equal(seen.init.headers["x-api-key"], KEY);
  assert.ok(seen.init.signal instanceof AbortSignal);
});

test("askAssistant maps failures to AssistantError messages", async () => {
  const run = (fetchImpl, over = {}) => askAssistant({ task: "check", text: "Hallo", key: KEY, fetchImpl, ...over });
  await assert.rejects(run(async () => failing(401, "invalid x-api-key")), /geçersiz/);
  await assert.rejects(run(async () => failing(429, "rate")), /limit/);
  await assert.rejects(run(async () => { throw new TypeError("Failed to fetch"); }), /İnternet/);
  await assert.rejects(run(async () => reply(checkOk, { stop_reason: "max_tokens" })), /yarıda/);
  await assert.rejects(run(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "sorry" }] }) })), /anlaşılamadı/);
  await assert.rejects(run(async () => reply(checkOk), { key: "nope" }), /anahtarını ekle/);
  await assert.rejects(run(async () => reply(checkOk), { text: "" }), /Önce notuna/);
});

test("askAssistant times out instead of hanging", async () => {
  const hang = (_url, init) => new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  await assert.rejects(askAssistant({ task: "check", text: "Hallo", key: KEY, fetchImpl: hang, timeoutMs: 20 }), /zamanında/);
});

test("applyCorrection replaces the checked text or appends when the note changed", () => {
  assert.equal(applyCorrection("Notiz: Ich bin Hunger. Ende", "Ich bin Hunger.", "Ich habe Hunger."), "Notiz: Ich habe Hunger. Ende");
  assert.equal(applyCorrection("etwas anderes\n", "Ich bin Hunger.", "Ich habe Hunger."), "etwas anderes\nIch habe Hunger.");
  assert.equal(applyCorrection("  ", "x", "Ich habe Hunger."), "Ich habe Hunger.");
});

test("key storage is separate from settings and can be cleared", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.equal(saveAiKey("bad"), false);
  assert.equal(saveAiKey(KEY), true);
  assert.equal(getAiKey(), KEY);
  assert.equal(store.has("settings"), false);
  clearAiKey();
  assert.equal(getAiKey(), "");
  delete globalThis.localStorage;
});
