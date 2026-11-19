// LINEログイン後に戻ってくる場所。本人確認 → 友だち確認 → 先着枠の確保 を行う。
import crypto from 'node:crypto';
import {
  turso, cookie, parseCookies, redirect, signSession,
  CAMPAIGN, CAPACITY, PAGE_URL,
} from './_gift-lib.js';

async function exchangeCode(code) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINE_LOGIN_CALLBACK_URL,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function lineGet(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

function sameState(a, b) {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const clearState = cookie('gift_state', '', 0, '/api');

    // ログインをキャンセルした場合など
    if (url.searchParams.get('error')) return redirect(`${PAGE_URL}?status=cancel`, [clearState]);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !sameState(state, parseCookies(request).gift_state)) {
      return redirect(`${PAGE_URL}?status=expired`, [clearState]);
    }

    try {
      const token = await exchangeCode(code);
      const profile = await lineGet('https://api.line.me/v2/profile', token.access_token);
      const friendship = await lineGet('https://api.line.me/friendship/v1/status', token.access_token);

      if (!friendship.friendFlag) {
        return redirect(`${PAGE_URL}?status=not_friend`, [clearState]);
      }

      // すでに受け取り済みの人は、もう一度ダウンロード画面へ
      const existing = await turso.execute({
        sql: 'SELECT 1 FROM gift_claims WHERE campaign = ? AND line_user_id = ?',
        args: [CAMPAIGN, profile.userId],
      });

      if (existing.rows.length === 0) {
        // 先着枠の確保: 人数が上限未満のときだけ INSERT する(1文で判定するので同時アクセスでも超えない)
        const ins = await turso.execute({
          sql: `INSERT INTO gift_claims (campaign, line_user_id, display_name, claimed_at)
                SELECT ?, ?, ?, ?
                WHERE (SELECT COUNT(*) FROM gift_claims WHERE campaign = ?) < ?
                ON CONFLICT(campaign, line_user_id) DO NOTHING`,
          args: [CAMPAIGN, profile.userId, profile.displayName ?? null, Math.floor(Date.now() / 1000), CAMPAIGN, CAPACITY],
        });
        if (ins.rowsAffected === 0) {
          // 同時に同じ人が押した場合を除き、満員
          const again = await turso.execute({
            sql: 'SELECT 1 FROM gift_claims WHERE campaign = ? AND line_user_id = ?',
            args: [CAMPAIGN, profile.userId],
          });
          if (again.rows.length === 0) return redirect(`${PAGE_URL}?status=closed`, [clearState]);
        }
      }

      return redirect(`${PAGE_URL}?status=ok`, [clearState, cookie('gift_session', signSession(profile.userId), 30 * 60)]);
    } catch (err) {
      console.error('gift-callback failed', err.message);
      return redirect(`${PAGE_URL}?status=error`, [clearState]);
    }
  },
};
