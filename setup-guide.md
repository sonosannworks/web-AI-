# フォーム回答 一元管理ダッシュボード セットアップ手順

## 1. Google Cloud サービスアカウントを作成
1. https://console.cloud.google.com/ で既存プロジェクト(なければ新規作成)を開く
2. 「APIとサービス」→「ライブラリ」で **Google Sheets API** を有効化
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」
4. 名前は何でもよい(例: `forms-dashboard-reader`)、ロールは付与不要
5. 作成後、サービスアカウントの詳細画面 →「キー」タブ →「鍵を追加」→「新しい鍵を作成」→ JSON
6. ダウンロードされたJSONの中の `client_email` と `private_key` を控える(このJSONファイルはGitに入れない)

## 2. 各スプレッドシートを共有
対象の4つのスプレッドシートで、それぞれサービスアカウントを共有に追加します:
1. 右上の「共有」
2. 手順1の `client_email`(例: `xxx@xxx.iam.gserviceaccount.com`)を追加
3. 権限は以下の通り:
   - クライアントフォーム / お問い合わせ / ポートフォリオモニター募集 → **閲覧者**でOK
   - **blog → 編集者**にする(管理画面から新規追加・編集を行うため書き込み権限が必要)

## 3. スプレッドシートID(確認済み)

| シート | ID |
|---|---|
| クライアントフォーム | `1UwPCBBXfGu2DnrMpIIrupm0Ro80QMzcMoi2bIjYpO8k` |
| お問い合わせフォーム | `1SvNS5iT7DArQiM2yUG1phI_qwWXOrBR48zpNrMu1fVM` |
| ポートフォリオモニター募集 | `1yWRG-_Sunj0vEJTBTPmXatwrYcibvGnh3nx4aa_GNsI` |
| blog | `1tLA_NN6xmfP2Xk8KcpnHf-FLUftufI9RxSeWyY-_wiA` |

## 4. Vercelに環境変数を追加
プロジェクト(既存の `web-ai-support`)の Settings → Environment Variables に追加:

| 変数名 | 値 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントのメールアドレス |
| `GOOGLE_PRIVATE_KEY` | JSON内の `private_key` の値(改行はそのまま `\n` 表記で貼り付けてOK。api/forms.js側で変換します) |
| `SHEET_ID_CLIENT` | `1UwPCBBXfGu2DnrMpIIrupm0Ro80QMzcMoi2bIjYpO8k` |
| `SHEET_ID_INQUIRY` | `1SvNS5iT7DArQiM2yUG1phI_qwWXOrBR48zpNrMu1fVM` |
| `SHEET_ID_MONITOR` | `1yWRG-_Sunj0vEJTBTPmXatwrYcibvGnh3nx4aa_GNsI` |
| `SHEET_ID_BLOG` | `1tLA_NN6xmfP2Xk8KcpnHf-FLUftufI9RxSeWyY-_wiA` |

`ADMIN_PASSWORD` は既存のものをそのまま使い回してOKです。

## 5. パッケージを追加
プロジェクトのルートで:
```
npm install googleapis
```
`package.json` の依存関係に `googleapis` が追加されます。

## 6. ファイルを配置
- `api/forms.js` を既存の `api/purchases.js` と同じ `api/` フォルダに追加
- `admin.html` に `admin-tabs-snippet.html` の内容を統合
  - タブのHTML部分を、ログイン後に表示される管理画面のコンテナ内に貼り付け
  - `<script>` 部分は既存のログイン処理(パスワード認証してsessionStorageにトークン保存する箇所)の**後**に追加
  - ログイン成功時に呼んでいる処理の最後に `window.__showFormsTab('purchases')` を呼ぶ1行を足すと、ログイン直後に購入履歴タブが表示されます

## 7. シート名の確認
`api/forms.js` 内の `sheetName: 'フォームの回答 1'` は、Googleフォームが自動生成する回答シートのデフォルト名です。
シート名を変更している場合や、1シート内に複数フォームの回答がある場合は、この部分をスプレッドシートの実際のシート名に合わせて書き換えてください。

blogシートはGoogleフォームの回答ではない可能性があるため、`sheetName` を暫定で `'シート1'` にしています。実際のシート名(タブ名)が違う場合はここを修正してください。また列構成がフォーム回答と違い先頭列が日付でない場合に備えて、`api/forms.js` はソートを自動でスキップする作りにしてあります。

## 8. blogの新規追加・編集について
- 管理画面のblogタブにのみ「＋新規追加」ボタンと各行の「編集」ボタンが表示されます
- フォームの入力項目は、blogシートの1行目(ヘッダー行)の列名から自動生成されるので、列を追加・変更してもコードの修正は不要です
- 先頭列の見出しに「タイムスタンプ」または「日時」という文字が含まれる場合、新規追加時に空欄なら自動で現在時刻が入ります
- 書き込みには前述の通りblogシートを「編集者」権限で共有しておく必要があります(手順2)

## 8. 動作確認
1. `git add . && git commit -m "add forms dashboard" && git push`
2. Vercelでデプロイ完了を待つ
3. `https://web-ai-support.vercel.app/admin.html` にアクセスし、パスワードでログイン
4. 「初回ヒアリング」「お問い合わせ」「アンケート」タブを開き、それぞれのスプレッドシートの内容が新しい順に表示されることを確認

## 補足:新着の見分け方について
`admin-tabs-snippet.html` は、各タブを最後に開いた日時をブラウザの `localStorage` に保存し、それより新しいタイムスタンプの行に黄色いハイライト(`.record-new`)を付けます。
これはあくまで「このブラウザで最後にこのタブを開いた時刻」との比較なので、複数端末で見る場合はブラウザごとに新着判定が変わる点にご注意ください。
