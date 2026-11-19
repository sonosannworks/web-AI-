// 「LINEでログインして受け取る」ボタンの行き先。LINEログイン画面へ転送する。
import crypto from 'node:crypto';
import { cookie, redirect } from './_gift-lib.js';

export default {
  async fetch(request) {
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

    // 満員かどうかは戻ってきた後(gift-callback)で判定する。受け取り済みの人が再ダウンロードできるように。
    const state = crypto.randomBytes(24).toString('base64url');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINE_LOGIN_CHANNEL_ID,
      redirect_uri: process.env.LINE_LOGIN_CALLBACK_URL,
      state,
      scope: 'profile openid',
      bot_prompt: 'aggressive', // ログイン時に公式アカウントの友だち追加を促す
    });

    return redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`, [
      cookie('gift_state', state, 10 * 60, '/api'),
    ]);
  },
};
