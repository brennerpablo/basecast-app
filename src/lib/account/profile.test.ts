import assert from "node:assert/strict";
import { test } from "node:test";

import {
  avatarUrl,
  DISPLAY_NAME_MAX,
  isUploadedAvatar,
  normalizeDisplayName,
  sniffImageType,
  userImage,
} from "./profile";

test("a display name is stored trimmed", () => {
  assert.deepEqual(normalizeDisplayName("  Jane Doe "), { ok: true, name: "Jane Doe" });
  assert.deepEqual(normalizeDisplayName("x".repeat(DISPLAY_NAME_MAX)), {
    ok: true,
    name: "x".repeat(DISPLAY_NAME_MAX),
  });
});

test("an empty, too long or non-text display name is refused", () => {
  assert.equal(normalizeDisplayName("   ").ok, false);
  assert.equal(normalizeDisplayName("x".repeat(DISPLAY_NAME_MAX + 1)).ok, false);
  assert.equal(normalizeDisplayName(undefined).ok, false);
  assert.equal(normalizeDisplayName(42).ok, false);
});

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

test("PNG, JPEG and WebP are told apart by their first bytes", () => {
  assert.equal(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), "image/png");
  assert.equal(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(
    sniffImageType(bytes(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBPVP8 "))),
    "image/webp",
  );
});

test("anything else is not a photo, whatever it claims to be", () => {
  assert.equal(sniffImageType(bytes()), null);
  assert.equal(sniffImageType(bytes(0x89, 0x50, 0x4e)), null);
  assert.equal(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  // A RIFF that is not WebP (a WAV file).
  assert.equal(sniffImageType(bytes(...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WAVE"))), null);
  assert.equal(sniffImageType(new TextEncoder().encode("GIF89a")), null);
});

test("the photo's URL changes with each upload", () => {
  const first = avatarUrl("u1", new Date(1_000));
  assert.equal(first, "/api/users/u1/avatar?v=1000");
  assert.notEqual(first, avatarUrl("u1", new Date(2_000)));
});

test("an uploaded photo wins over the Google one, which wins over none", () => {
  const avatar = { updatedAt: new Date(0) };
  const google = "https://lh3.googleusercontent.com/a/x";
  assert.equal(userImage("u1", avatar, google), avatarUrl("u1", avatar.updatedAt));
  assert.equal(userImage("u1", null, google), google);
  assert.equal(userImage("u1", null, null), null);
});

test("only an uploaded photo can be removed", () => {
  assert.equal(isUploadedAvatar(avatarUrl("u1", new Date(0))), true);
  assert.equal(isUploadedAvatar("https://lh3.googleusercontent.com/a/x"), false);
  assert.equal(isUploadedAvatar(null), false);
});
