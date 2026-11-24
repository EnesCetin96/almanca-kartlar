import { test } from "node:test";
import assert from "node:assert/strict";
import { toLogical, pressureWidth, eraseAt, strokeHit, LOGICAL_W } from "../js/ink/strokes.js";

const line = { tool: "pen", color: "#000", width: 4, points: [[0, 0, 0.5], [100, 0, 0.5]] };
const far = { tool: "pen", color: "#000", width: 4, points: [[0, 300, 0.5], [100, 300, 0.5]] };

test("toLogical maps card width to the logical width", () => {
  const rect = { left: 10, top: 20, width: 500, height: 200 };
  assert.deepEqual(toLogical(510, 120, rect), [LOGICAL_W, 200]);
});

test("pressureWidth returns base width at half pressure and scales around it", () => {
  assert.equal(pressureWidth(10, 0.5), 10);
  assert.ok(pressureWidth(10, 1) > pressureWidth(10, 0.1));
});

test("strokeHit detects points near the line only", () => {
  assert.equal(strokeHit(line, 50, 5, 10), true);
  assert.equal(strokeHit(line, 50, 50, 10), false);
});

test("eraseAt removes only touched strokes and returns a new array", () => {
  const input = [line, far];
  const out = eraseAt(input, 50, 2, 6);
  assert.deepEqual(out, [far]);
  assert.equal(input.length, 2);
});

test("eraseAt returns the same array when nothing is hit", () => {
  const input = [line, far];
  assert.equal(eraseAt(input, 500, 500, 6), input);
});
