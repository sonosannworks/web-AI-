// 配布ページに「残り○名」とダウンロード回数を表示するための情報を返す。
import { turso, countClaims, json, parseCookies, verifySession, CAMPAIGN, CAPACITY, MAX_DOWNLOADS_PER_ITEM } from './_gift-lib.js';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    try {
      const claimed = await countClaims();
      const result = { capacity: CAPACITY, remaining: Math.max(0, CAPACITY - claimed), maxDownloads: MAX_DOWNLOADS_PER_ITEM };

      const userId = verifySession(parseCookies(request).gift_session);
      if (userId) {
        const r = await turso.execute({
          sql: 'SELECT display_name, dl_kadai, dl_careplan FROM gift_claims WHERE campaign = ? AND line_user_id = ?',
          args: [CAMPAIGN, userId],
        });
        if (r.rows[0]) {
          result.me = {
            name: r.rows[0].display_name,
            kadai: Number(r.rows[0].dl_kadai),
            careplan: Number(r.rows[0].dl_careplan),
          };
        }
      }
      return json(result);
    } catch (err) {
      console.error('gift-status failed', err.message);
      return json({ error: 'Database error' }, 500);
    }
  },
};
