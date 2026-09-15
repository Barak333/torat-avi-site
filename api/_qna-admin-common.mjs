const encoder = new TextEncoder();

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function timingSafeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index % Math.max(1, a.length)) || 0) ^ (b.charCodeAt(index % Math.max(1, b.length)) || 0);
  }
  return mismatch === 0;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function verifyPassword(password, encodedHash) {
  const [scheme, iterationsText, saltText, expectedText] = String(encodedHash || "").split("$");
  if (scheme !== "pbkdf2_sha256") return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  try {
    const material = await crypto.subtle.importKey("raw", encoder.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(saltText),
      iterations
    }, material, 256));
    return timingSafeEqual(bytesToBase64Url(actual), expectedText);
  } catch {
    return false;
  }
}

export async function createSession(email) {
  const secret = process.env.QNA_ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing QNA_ADMIN_SESSION_SECRET");
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    email,
    exp: Date.now() + 8 * 60 * 60 * 1000,
    nonce: crypto.randomUUID()
  })));
  return `${payload}.${await hmac(payload, secret)}`;
}

function readCookie(request, name) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return "";
}

export async function readSession(request) {
  const token = readCookie(request, "qna_admin_session");
  const secret = process.env.QNA_ADMIN_SESSION_SECRET;
  if (!token || !secret) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!timingSafeEqual(signature, await hmac(payload, secret))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!session.email || !session.exp || session.exp < Date.now()) return null;
    if (session.email.toLowerCase() !== String(process.env.QNA_ADMIN_EMAIL || "").trim().toLowerCase()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(token, secure = true) {
  return `qna_admin_session=${token}; Path=/; Max-Age=28800; HttpOnly;${secure ? " Secure;" : ""} SameSite=Strict`;
}

export function clearSessionCookie(secure = true) {
  return `qna_admin_session=; Path=/; Max-Age=0; HttpOnly;${secure ? " Secure;" : ""} SameSite=Strict`;
}

export function clean(value, maxLength) {
  return String(value ?? "").replace(/\u0000/gu, "").replace(/\r\n?/gu, "\n").trim().slice(0, maxLength);
}
