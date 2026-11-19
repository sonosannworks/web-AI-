# 先着50名 無料配布(gift)の設定手順

配布ページ: https://web-ai-support.vercel.app/gift.html

## しくみ
1. 配布ページで「LINEでログインして受け取る」を押す
2. LINEログイン → 公式アカウントの友だちか確認(友だちでなければ受け取れない)
3. Tursoの `gift_claims` に1人1行で記録。50人に達したら自動で締め切り
4. ダウンロードボタン → 5分だけ有効なURLでZIPを渡す(同じZIPは1人3回まで)
5. ZIPは Vercel Blob の「非公開(Private)」ストアに置くので、GitHubにもサイトにも出ない

## 作業1: Vercel Blob(非公開)にZIPを置く
1. Vercel → web-ai-support プロジェクト → Storage → Create → **Blob**
2. アクセスは **Private** を選ぶ(あとから変更不可)。ストア名は例: `gift-private`
3. 「Connect Project」で web-ai-support につなぐ(環境変数は自動で入る)
4. ストアのBrowser画面で、`gift` フォルダを作り、次の名前でアップロード
   - `gift/kadai-seiri-souhyo.zip` … 課題整理総括表Skill
   - `gift/care-assessment-to-careplan.zip` … ケアプランSkill
   ※ ダウンロード時のファイル名はこの名前になります

## 作業2: LINE Developers(LINEログインチャネル)
「sonosann Web&AIサポート」プロバイダー内の **LINEログインチャネル** を開く
1. チャネル基本設定 → **リンクされたLINE公式アカウント** に「sonosann Web&AIサポート」を設定
   (友だち確認・友だち追加の案内に必要)
2. LINEログイン設定 → **コールバックURL** に次を1行追加(エルメ用のURLは消さない)
   `https://web-ai-support.vercel.app/api/gift-callback`
3. チャネル基本設定の **チャネルID** と **チャネルシークレット** を控える

## 作業3: Vercelの環境変数(Production)
| 名前 | 値 |
|---|---|
| LINE_LOGIN_CHANNEL_ID | 作業2のチャネルID |
| LINE_LOGIN_CHANNEL_SECRET | 作業2のチャネルシークレット |
| LINE_LOGIN_CALLBACK_URL | https://web-ai-support.vercel.app/api/gift-callback |
| GIFT_SESSION_SECRET | ランダムな文字列(下のコマンドで作成) |
| GIFT_CAPACITY | 50(省略しても50) |

GIFT_SESSION_SECRET の作り方(PowerShell):
```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 作業4: Tursoにテーブルを作る
`db/gift_claims.sql` の CREATE TABLE 文を web-ai-support DB で1回実行
(Claude Code の turso-cloud に「db/gift_claims.sql を実行して」と頼めばOK)

## 作業5: プッシュして動作確認
1. コミット・プッシュ(Vercelが自動デプロイ)
2. 自分のLINEで gift.html から受け取り → 2つのZIPが落ちるか確認
3. 確認が終わったら、自分の記録を消して枠を戻す:
```
DELETE FROM gift_claims WHERE campaign = 'cm-skill-2026-11' AND display_name = '(自分のLINE表示名)';
```

## 配布の案内
- エルメの自動返信・LINE配信・YouTube概要欄などに `https://web-ai-support.vercel.app/gift.html` を載せる
- 人数制限・友だち確認はページ側で行うので、エルメのフォームで人数を数える必要はありません

## 受け取った人を見る
```
SELECT display_name, datetime(claimed_at, 'unixepoch', '+9 hours') AS 受取日時, dl_kadai, dl_careplan
FROM gift_claims WHERE campaign = 'cm-skill-2026-11' ORDER BY claimed_at;
```

## 締め切り・終了
- 50人に達すると自動で締め切り(受け取り済みの人は再ダウンロード可)
- 途中で締め切るとき: 環境変数 GIFT_CAPACITY を 0 にして再デプロイ
- 完全に終わるとき: Blobの `gift/` のZIPを削除 → ダウンロード不可になります
- 次回また配布するとき: `api/_gift-lib.js` の CAMPAIGN 名と ITEMS を変える
