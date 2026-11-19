-- 先着配布の受け取り記録(Turso: web-ai-support に1回だけ実行)
CREATE TABLE IF NOT EXISTS gift_claims (
  campaign         TEXT    NOT NULL,           -- 配布キャンペーン名(例: cm-skill-2026-11)
  line_user_id     TEXT    NOT NULL,           -- LINEのユーザーID(1人1行)
  display_name     TEXT,                       -- LINEの表示名(確認用)
  claimed_at       INTEGER NOT NULL,           -- 受け取った日時(unix秒)
  dl_kadai         INTEGER NOT NULL DEFAULT 0, -- 課題整理総括表ZIPのダウンロード回数
  dl_careplan      INTEGER NOT NULL DEFAULT 0, -- ケアプランZIPのダウンロード回数
  last_download_at INTEGER,
  PRIMARY KEY (campaign, line_user_id)
);

-- 受け取った人の一覧を見るとき
-- SELECT display_name, datetime(claimed_at, 'unixepoch', '+9 hours') AS 受取日時, dl_kadai, dl_careplan
-- FROM gift_claims WHERE campaign = 'cm-skill-2026-11' ORDER BY claimed_at;
