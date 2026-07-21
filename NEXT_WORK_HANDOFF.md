# 次作業ハンドオフ

更新日: 2026-07-21 JST

## 現在の正本と作業方針

- GitHub の `mayumi-hanaeda/gaosys` リポジトリの `main` が、唯一の共有正本である。
- 正規の作業ディレクトリは `C:\GAOSYS２\gaosys-github`。旧作業ディレクトリや `archive/` は正本ではない。
- Pull Request は採用しない。開発担当者は、目的と検証結果が追える単位で `main` へ直接コミットしてよい。
- ブランチは通常作らない。同じファイルまたは機能領域への同時変更で競合する見込みがある場合だけ作る。
- 問題が起きた変更は、GitHub 上のコミットを復旧点として特定し、原則 `git revert` で戻す。公開済み `main` の強制書換えはしない。
- 担当者は経験のためにデプロイ操作を行ってよい。ただし production への影響がある操作は、AGENTS.md に従って影響範囲・ロールバック方法を提示し、ユーザーの明示承認を得る。

## 文書の読み順

1. `AGENTS.md`: グランドルール、共同作業、機密情報、本番操作の原則。
2. `DEPLOYMENT.md`: push・デプロイの手順と検証基準。
3. `RUNBOOK.md`: 障害時の復旧手順。
4. この `NEXT_WORK_HANDOFF.md`: 現在の作業再開情報。
5. `SESSION_HANDOFF.md`: 過去の経緯の保管用。現在の状態を判断しない。

Google Docs、ルートディレクトリの旧 handoff、旧作業ディレクトリは参考資料または履歴であり、共有正本ではない。そこから採用する内容がある場合は、確認した上でこのリポジトリの文書またはコミットへ反映する。

## 再開時の確認

1. `git status --short --branch` と `git log --oneline -5` で、未コミット変更と復旧点を確認する。
2. 作業対象が `main` と衝突しそうか確認する。衝突しない通常作業はそのまま進め、衝突見込みがある場合だけブランチを作る。
3. 実環境に触れる必要がある場合のみ、`.local/OPERATIONS.md` と `clasp deployments` を照合する。値はチャット、Git、証跡に書かない。
4. Apps Script への push 前に、`node --test tests/*.test.mjs`、`node scripts/check-deployment.mjs`、`clasp status --user default` を実行し、対象ファイルと結果を確認する。
5. production へ影響する操作は、対象 deployment、影響範囲、ロールバック、検証方法を提示してから実行する。

## 現在の留意事項

- GitHub への HTTPS push 権限は、2026-07-12 時点で確認が完了していない。push が 403 になった場合は繰り返さず、認証中のアカウントとリポジトリ権限を確認する。
- 保存済みの production/test deployment 情報は過去の記録であり、現在値ではない。変更・調査・デプロイ時は必ず実測する。
- `.local/`、OAuth 関連、Webhook URL、実ID、実URL、個人情報、raw logs は GitHub に置かない。

## この文書の更新

作業の中断時または共有判断が変わった時だけ、この文書を更新する。実装の詳細、長い調査ログ、秘密値はここに残さない。
