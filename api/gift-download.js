// ダウンロードボタンの行き先。受け取り済みの本人か確認し、5分だけ有効なURLへ転送する。
import { issueSignedToken, presignUrl } from '@vercel/blob';
import {
  turso, parseCookies, redirect, verifySession,
  CAMPAIGN, ITEMS, MAX_DOWNLOADS_PER_ITEM, PAGE_URL,
} from './_gift-lib.js';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

    const userId = verifySession(parseCookies(request).gift_session);
    if (!userId) return redirect(`${PAGE_URL}?status=expired`);

    const itemKey = new URL(request.url).searchParams.get('item');
    const item = ITEMS[itemKey];
    if (!item) return new Response('Not Found', { status: 404 });

    try {
      const token = await issueSignedToken({
        pathname: item.pathname,
        operations: ['get'],
        validUntil: Date.now() + 10 * 60 * 1000,
      });
      const { presignedUrl } = await presignUrl(token, {
        operation: 'get',
        pathname: item.pathname,
        access: 'private',
        validUntil: Date.now() + 5 * 60 * 1000,
      });
      // URLを作れたら、回数制限つきでカウントを増やす(受け取り済みの人だけが対象)
      const upd = await turso.execute({
        sql: `UPDATE gift_claims
              SET ${item.column} = ${item.column} + 1, last_download_at = ?
              WHERE campaign = ? AND line_user_id = ? AND ${item.column} < ?`,
        args: [Math.floor(Date.now() / 1000), CAMPAIGN, userId, MAX_DOWNLOADS_PER_ITEM],
      });
      if (upd.rowsAffected === 0) return redirect(`${PAGE_URL}?status=limit`);

      return redirect(presignedUrl);
    } catch (err) {
      console.error('gift-download failed', err.message);
      return redirect(`${PAGE_URL}?status=error`);
    }
  },
};
