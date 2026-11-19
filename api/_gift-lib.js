// 先着配布(ギフト)の共通処理。ファイル名が _ で始まるので Vercel の API にはならない。
import crypto from 'node:crypto';
import { createClient } from '@libsql/client';

// ===== 設定 =====
export const CAMPAIGN = 'cm-skill-2026-11'; // 配布キャンペーン名(次回配布するときは変える)
export const CAPACITY = Number(process.env.GIFT_CAPACITY || 50); // 先着人数
export const MAX_DOWNLOADS_PER_ITEM = 3; // 同じ人が同じZIPを落とせる回数(失敗時の再ダウンロード用)

// 配布物: item名 → Vercel Blob(private)上のパス
export const ITEMS = {
  kadai: { pathname: 'gift/kadai-seiri-souhyo.zip', column: 'dl_kadai' },
  careplan: { pathname: 'gift/care-assessment-to-careplan.zip', column: 'dl_careplan' },
};

export const PAGE_URL = '/gift.html';

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ===== Cookie =====
export function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, maxAgeSec, path = '/') {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}

// ===== 署名付きセッション(LINEのuserIdを30分だけ覚える) =====
function hmac(data) {
  const secret = process.env.GIFT_SESSION_SECRET;
  if (!secret) throw new Error('GIFT_SESSION_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function signSession(userId, ttlSec = 30 * 60) {
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: Date.now() + ttlSec * 1000 })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

export function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.u || Date.now() > data.exp) return null;
    return data.u;
  } catch {
    return null;
  }
}

export function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function countClaims() {
  const r = await turso.execute({
    sql: 'SELECT COUNT(*) AS n FROM gift_claims WHERE campaign = ?',
    args: [CAMPAIGN],
  });
  return Number(r.rows[0].n);
}
