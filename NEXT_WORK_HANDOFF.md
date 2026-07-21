# 次作業ハンドオフ

更新日: 2026-07-22 JST

## 引継ぎ時点の確定状態

- 共有正本は GitHub `mayumi-hanaeda/gaosys` の `main` のみ。
- 正規の作業ディレクトリは `C:\GAOSYS２\gaosys-github`。`archive/`、旧作業ディレクトリ、ルート側の旧 handoff は正本ではない。
- GitHub への push は 2026-07-22 JST に成功した。現在の基準コミットと復旧点は、作業開始時に `git log --oneline -5` で確認する。共同作業方針を定義したコミットは `f3f0509`（`docs: define canonical collaboration workflow`）。
- 引継ぎ作成時点で、作業ツリーはクリーンであり、未コミットのソースコード・設定変更・デプロイ変更はない。
- 直近の変更は文書整理だけであり、Apps Script への `clasp push`、version 作成、deployment 更新、本番操作は行っていない。

## 採用済みの共同作業方針

- Pull Request は採用しない。開発担当者は、目的と検証結果が追える単位で `main` へ直接コミットしてよい。
- ブランチは通常作らない。同じファイルまたは機能領域への同時変更で競合する見込みがある場合だけ作る。
- 問題が発生した反映は、GitHub 上のコミット SHA を復旧点として特定し、原則 `git revert` で取り消す。公開済み `main` を `push --force` や履歴改変で書き換えない。
- 担当者はデプロイ操作を経験してよい。ただし production に影響する操作は、対象、影響範囲、ロールバック、検証方法を示してユーザーの明示承認を得る。

詳細は必ず `AGENTS.md` の第 0 章を読むこと。

## 文書の読み順

1. `AGENTS.md`: グランドルール、共同作業、機密情報、本番操作の原則。
2. この `NEXT_WORK_HANDOFF.md`: 現在の基準状態と次担当者の開始手順。
3. `DEPLOYMENT.md`: Apps Script の push・デプロイ前チェック。
4. `RUNBOOK.md`: 障害時の復旧手順。
5. `SESSION_HANDOFF.md`: 歴史的経緯の案内。現在の判断には使用しない。

Google Docs とルートディレクトリの旧資料は参考・履歴扱いである。採用する内容があれば、確認してこのリポジトリの文書またはコミットへ反映する。

## 次担当者の開始手順

1. `git status --short --branch` と `git log --oneline -5` を実行し、作業ツリーと復旧点を確認する。
2. 実装タスクが新たに指示されるまで、ソースコード、設定、Apps Script、本番環境を変更しない。
3. タスクを受けたら、既存実装・仕様・影響範囲を確認する。競合見込みがなければ `main` で作業し、ある場合だけブランチを作る。
4. Apps Script へ push する前に、`node --test tests/*.test.mjs`、`node scripts/check-deployment.mjs`、`clasp status --user default` を実行する。
5. production に関わる操作では、`.local/OPERATIONS.md` と実際の `clasp deployments` を照合し、実値を Git・チャット・証跡へ出さない。

## 未実施・要確認事項

- 現在の production/test deployment、Script Properties、実行アカウントは、この引継ぎでは再確認していない。調査・変更・デプロイ時に実測すること。
- 本番の Calendar 登録に関する過去の問題は、現時点での再現有無が未確認。対応時はまず `RUNBOOK.md` と現環境を照合すること。
- GitHub push は 2026-07-22 JST に成功済み。次回も通常の `git push origin main` を使い、認証変更・強制push・履歴書換えを行わない。

## 機密情報の扱い

`.local/`、OAuth 関連、Webhook URL、実ID、実URL、個人情報、raw logs は GitHub に置かない。必要な実運用情報は `.local/OPERATIONS.md` にだけ記録し、値ではなくキー名・状態・確認日時を共有する。
