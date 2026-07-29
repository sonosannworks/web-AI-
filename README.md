# sonosann Web&AIサポート

「sonosann Web&AIサポート」の事業サイトのソースコードです。

看護師25年・ケアマネジャー7年の現場経験を持つ代表が、Web制作とAI活用支援を通じて
介護事業所のDXを支援するサービスを提供しています。本リポジトリには、その事業サイト
（サービス紹介・導入事例・会社概要・お問い合わせ）と、フォーム回答／購入履歴を確認する
ための管理画面が含まれます。

## 本番URL

https://sonosann-webai.net/

## 技術構成

### フロントエンド

フレームワークやビルドツールは使用していません。素のHTML/CSS/JavaScriptで構成されています。

| 項目 | 内容 |
|---|---|
| HTML | 静的HTML（`index.html` / `admin.html`） |
| CSS | 手書きCSS（`style.css`）。CSSカスタムプロパティで配色・フォントを管理 |
| JavaScript | 素のJavaScript（ES5相当の書き方・バンドラなし） |
| フォント | Google Fonts（Zen Maru Gothic / Noto Sans JP） |
| アクセス解析 | Google Analytics 4（`index.html` に直接埋め込み） |

### バックエンド（Vercel サーバーレス関数）

`api/` 配下はVercelのサーバーレス関数です。Node.js 24.x・ESM（`package.json` の
`"type": "module"`）で動作します。

| 依存パッケージ | 用途 |
|---|---|
| `googleapis` | Google Sheets APIの読み書き（フォーム回答の取得、blogシートの追加・更新） |
| `@libsql/client` | Turso（libSQL）への接続。購入履歴の保存・取得 |
| `stripe` | Stripe Webhookの署名検証と決済情報の取得 |

### ホスティング

**GitHub Pages と Vercel の2系統に、同じリポジトリをデプロイしています。**

| | GitHub Pages | Vercel |
|---|---|---|
| URL | https://sonosann-webai.net/ | https://web-ai-support.vercel.app/ |
| 役割 | 一般公開している事業サイト | 管理画面 + API |
| 設定 | `CNAME`（カスタムドメイン） | `vercel.json` / プロジェクト名 `web-ai-support` |
| `api/` の動作 | **動かない**（404が返る） | 動く |

`api/` を使う機能（管理画面のフォーム回答一覧・購入履歴）は、Vercel側のURLでのみ
利用できます。`admin.html` は https://web-ai-support.vercel.app/admin.html から
アクセスしてください。なお `sonosannworks.github.io/web-AI-/` へのアクセスは
カスタムドメインへ301リダイレクトされます。

APIの動作には環境変数の設定が必要です。詳細は [`setup-guide.md`](setup-guide.md) を参照してください。

## ディレクトリ構成

```
.
├── index.html          サイト本体（1ページ構成）
├── header.html         共通ヘッダー（部分HTML）
├── footer.html         共通フッター（部分HTML）
├── script.js           部分HTMLの読み込みとナビ開閉
├── style.css           全体のスタイル
├── admin.html          管理画面（パスワード認証・フォーム回答・購入履歴）
├── api/
│   ├── forms.js            Googleスプレッドシートの回答を取得／blogシートの追加・更新
│   ├── purchases.js        Tursoから購入履歴を取得
│   └── stripe-webhook.js   Stripeの決済完了Webhookを受け、購入履歴をTursoに保存
├── image/              サイト内で使用する画像
├── CNAME               GitHub Pages用カスタムドメイン設定
├── vercel.json         Vercel設定（stripe-webhookのmaxDuration）
├── .vercelignore       Vercelへアップロードしないファイル（動画・参考画像など）
├── robots.txt / sitemap.xml
└── setup-guide.md      管理画面まわりのセットアップ手順
```

### 主要ファイルの役割

**`index.html`** は1ページ構成で、`#hero` / `#service` / `#app` / `#about` / `#contact`
の各セクションを持ちます。ヘッダーとフッターは直接書かず、
`<div id="site-header-placeholder">` / `<div id="site-footer-placeholder">` という
プレースホルダだけを置いています。

**`script.js`** は `DOMContentLoaded` のタイミングで `loadPartial()` を呼び、
`header.html` と `footer.html` を `fetch` してプレースホルダを置き換えます。
ヘッダー読み込み後に `initNav()` が呼ばれ、ハンバーガーメニューの開閉が有効になります。

**`header.html` / `footer.html`** は `<header>` / `<footer>` 要素だけを含む部分HTMLです。
単体で開いても意味を成さず、`script.js` 経由で読み込まれることを前提としています。

> `script (1).js` と `style (1).css` は、どのHTMLからも参照されていない旧版のファイルです。

### ポートフォリオ側とのヘッダー共通化

`header.html` は、**ポートフォリオサイト側からも参照されています。**
ポートフォリオ側の一部ページに、web&AIサポートサイトから遷移してきた場合だけ
ヘッダーを差し替える仕組みがあり、その差し替え元がこのリポジトリの `header.html` です。

仕組みは次の通りです（実装はポートフォリオ側の `script.js`）。

1. このリポジトリの `header.html` から、ポートフォリオ側のアプリへのリンクに
   `?from=webai` を付けておく
   （例: `https://start-reposi.vercel.app/mini-games.html?from=webai`）
2. 遷移先のページで `initWebAiHeaderSwap()` が実行され、URLに `from=webai` があるかを判定する
3. ある場合は `<html>` に `webai-mode` クラスを付与し、CSSでポートフォリオ本来のヘッダーを非表示にする
4. 定数 `WEBAI_SITE_BASE`（= `https://sonosann-webai.net/`）を使って
   `https://sonosann-webai.net/header.html` を `fetch` し、ページ先頭に挿入する
5. 取得に失敗した場合は、ポートフォリオ側に持たせた複製版（`WEBAI_HEADER_FALLBACK`）を表示する

これにより、web&AIサポートサイトからポートフォリオ側のアプリへ移動しても、
ヘッダーの見た目が変わらず同一サイト内を回遊しているように見えます。

**この `header.html` を変更すると、ポートフォリオ側の表示にも影響します。**
特にクラス名（`.site-header` / `.logo` / `.global-nav` / `.nav-app-link` など）は、
ポートフォリオ側のCSSとフォールバックHTMLが前提にしているため、変更時は
ポートフォリオ側も併せて確認してください。

## ローカルでの動作確認

`script.js` が `fetch()` でヘッダー・フッターを読み込むため、`index.html` を
ブラウザで直接開く（`file://`）とヘッダーとフッターが表示されません。
必ずHTTPサーバー経由で確認してください。

```bash
python -m http.server 8000
```

起動後、http://localhost:8000/ を開きます。ポート番号は任意です（これまで8321・8322などを使用）。

`api/` を含めて動作確認したい場合は、Vercel CLIを使います。環境変数の設定が必要です。

```bash
npx vercel dev
```

初回は `npm install` で依存パッケージを取得してください。

## 関連リポジトリ

### portfolio（ポートフォリオサイト）

- リポジトリ: [sonosannworks/start_reposi](https://github.com/sonosannworks/start_reposi)
- URL: https://start-reposi.vercel.app/

代表個人のポートフォリオサイトです。「認知症miniGAME」「ケアプラン作成支援アプリ」などの
制作物を公開しており、このリポジトリの `header.html` を一部ページで共通利用しています
（詳細は上記「ポートフォリオ側とのヘッダー共通化」を参照）。

対象ページは `mini-games.html` / `cmsupport.html` / `kaigo-hp-support.html` /
`persona-works.html` の4ページです。また、ポートフォリオ側のヘッダーロゴは
本サイト（https://sonosann-webai.net/）にリンクしています。
