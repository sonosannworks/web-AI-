// api/forms.js
// 複数のGoogleフォーム回答スプレッドシートを読み込み、JSONで返すVercelサーバーレス関数。
// blogシートのみ、管理画面から新規追加(POST)・編集(PATCH)ができる。
// admin.htmlの既存パスワード認証(ADMIN_PASSWORD)をそのまま流用する前提。
//
// 必要な環境変数(Vercel Production/Preview両方に設定):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   ... サービスアカウントのメールアドレス
//   GOOGLE_PRIVATE_KEY             ... サービスアカウントの秘密鍵(改行は \n のまま貼り付け)
//   ADMIN_PASSWORD                 ... 既存のadmin.htmlと同じ管理パスワード
//   SHEET_ID_CLIENT                 ... クライアントフォーム用スプレッドシートID
//   SHEET_ID_INQUIRY                ... お問い合わせフォーム用スプレッドシートID
//   SHEET_ID_MONITOR                ... ポートフォリオモニター募集用スプレッドシートID
//   SHEET_ID_BLOG                   ... blog用スプレッドシートID
//
// フロントからは:
//   GET   /api/forms?type=client|inquiry|monitor|blog          ... 一覧取得
//   GET   /api/forms?type=blog&headers=1                       ... ヘッダー(列名)のみ取得
//   POST  /api/forms?type=blog   body: {列名: 値, ...}          ... 新規行を追加
//   PATCH /api/forms?type=blog   body: {row: 3, values: {...}} ... 指定行を更新
// (POST/PATCHはblog以外のtypeでは403)

import { google } from 'googleapis';

// タブ種別 → 環境変数名・シート範囲のマッピング。
// スプレッドシートが増えたらここに1行足すだけでよい。
// range のシート名部分は、実際のシート名(タブ名)と違う場合は書き換えてください。
const SHEET_MAP = {
  client:  { envKey: 'SHEET_ID_CLIENT',  sheetName: 'フォームの回答 1' },
  inquiry: { envKey: 'SHEET_ID_INQUIRY', sheetName: 'フォームの回答 1' },
  monitor: { envKey: 'SHEET_ID_MONITOR', sheetName: 'フォームの回答 1' },
  blog:    { envKey: 'SHEET_ID_BLOG',    sheetName: 'シート1' },
};

// 管理画面から書き込み(新規追加・編集)を許可するタイプ。今のところblogのみ。
const WRITABLE_TYPES = ['blog'];

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function checkAuth(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  return timingSafeEqual(token, expected);
}

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    // blogシートへの書き込みに対応するため、readonlyではなくフルスコープを使用する。
    // 実際に書き込めるかどうかは各スプレッドシート側の共有権限(閲覧者/編集者)で決まるので、
    // clientやinquiryなど「閲覧者」共有のシートはこのスコープでも書き込み不可のまま安全。
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

// 列数(1始まり)をA, B, ... Z, AA... のアルファベットに変換
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// 1行目(ヘッダー行)だけを取得
async function getHeaders(sheets, spreadsheetId, sheetName) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`,
  });
  return (result.data.values && result.data.values[0]) || [];
}

// 1行目をヘッダーとみなし、[{列名: 値, ...}, ...] の配列に変換して新しい順に並べる。
// Googleフォームの回答シートは1列目が「タイムスタンプ」である前提。
// 先頭列が日付として解釈できない場合(blogシート等)はソートせず元の順番のまま返す。
function rowsToRecords(values) {
  if (!values || values.length < 2) return [];
  const [header, ...rows] = values;
  const records = rows.map((row, i) => {
    const record = { _row: i + 2 };
    header.forEach((col, idx) => {
      record[col || `col${idx}`] = row[idx] ?? '';
    });
    return record;
  });
  const tsKey = header[0];
  const allValidDates = records.every((r) => !isNaN(new Date(r[tsKey]).getTime()));
  if (allValidDates) {
    records.sort((a, b) => new Date(b[tsKey]) - new Date(a[tsKey]));
  }
  return records;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = req.query.type;
  const sheetDef = SHEET_MAP[type];
  if (!sheetDef) {
    return res.status(400).json({ error: `Unknown type: ${type}. Use one of ${Object.keys(SHEET_MAP).join(', ')}` });
  }

  const spreadsheetId = process.env[sheetDef.envKey];
  if (!spreadsheetId) {
    return res.status(500).json({ error: `Missing env var ${sheetDef.envKey}` });
  }

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(500).json({ error: 'Failed to authenticate with Google Sheets' });
  }

  // ---- GET: 一覧取得、または headers=1 でヘッダーのみ取得 ----
  if (req.method === 'GET') {
    try {
      if (req.query.headers === '1') {
        const headers = await getHeaders(sheets, spreadsheetId, sheetDef.sheetName);
        return res.status(200).json({ type, headers });
      }
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetDef.sheetName}!A1:Z1000`,
      });
      const records = rowsToRecords(result.data.values);
      return res.status(200).json({ type, count: records.length, records });
    } catch (err) {
      console.error('Sheets API error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch sheet data' });
    }
  }

  // ---- POST/PATCH: blogのみ書き込み許可 ----
  if (!WRITABLE_TYPES.includes(type)) {
    return res.status(403).json({ error: `type=${type} is read-only` });
  }

  try {
    const headers = await getHeaders(sheets, spreadsheetId, sheetDef.sheetName);
    if (headers.length === 0) {
      return res.status(500).json({ error: 'Sheet has no header row' });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const rowValues = headers.map((h) => {
        // タイムスタンプ/日時っぽい先頭列が空欄なら現在時刻を自動入力
        if ((body[h] === undefined || body[h] === '') && h === headers[0] && /タイムスタンプ|日時/.test(h)) {
          return new Date().toISOString();
        }
        return body[h] ?? '';
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetDef.sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] },
      });
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const { row, values } = req.body || {};
      if (!row || !values) {
        return res.status(400).json({ error: 'Request body must include { row, values }' });
      }
      const rowValues = headers.map((h) => values[h] ?? '');
      const lastCol = colLetter(headers.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetDef.sheetName}!A${row}:${lastCol}${row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowValues] },
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Sheets API write error:', err.message);
    return res.status(500).json({ error: 'Failed to write sheet data' });
  }
}
