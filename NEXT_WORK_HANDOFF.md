# 次作業ハンドオフ

更新日: 2026-08-09 JST

## 引継ぎ時点の確定状態

- 共有正本は GitHub `mayumi-hanaeda/gaosys` の `main` のみ。
- 正規の作業ディレクトリは `C:\GAOSYS２\gaosys-github`。`archive/`、旧作業ディレクトリ、ルート側の旧 handoff は正本ではない。
- 現在の基準コミットと復旧点は、作業開始時に必ず `git log --oneline -5` で実測する（本書の記載は作成時点のスナップショットであり、時間経過で古くなる）。2026-08-08 JST 時点の最新コミットは `eb38612`（`fix: prevent orphaned evaluation-sheet copies and reject trashed reuse`）。
- ローカルテストは `node --test tests/*.test.mjs` で71件成功・0件失敗（2026-08-08 JST 時点）。`node scripts/check-deployment.mjs` は `ok: true`。
- Apps Script への `clasp push`（`@HEAD` のみ、動作確認用）は2026-08-08 JSTに実施したが、production deployment（固定バージョン）の更新・deploy操作は行っていない。

## 2026-08-09 更新: Calendarフォールバック検証、本番Script Properties整理、ロゴURL補完

- **Calendarフォールバック検証**: `REL-002`（`RELEASE_BLOCKER_CALENDAR_ACCESS.md`）に関連し、`code.js`の「既存予定IDが見つからない場合は新規予定作成へフォールバックする」処理が実際に機能するかを、本番に一切接続しない新規の隔離Apps Script + GCPプロジェクト（`gaosys-shirokuma-nogucchi`）上で検証した。旧TDD-005隔離環境のscriptIdは不明・アクセス不能だったため、新規に構築した。
  - 初回の検証手法（`deleteEvent()`で実イベントを削除）は、Calendarも Driveのゴミ箱と同様の「即時には存在しない扱いにならない」挙動があり、狙った状態を再現できず失敗した。
  - 手法を「申込リストH列の予定IDを実在しない偽IDへ直接書き換える」方式に修正して再実行した結果、フォールバックが正しく発動し、新規予定の作成に成功した（`verdict.ok: true`）。
  - **重要な限定事項**: この検証が確認したのは「予定IDが古い/存在しない」サブケースの是正のみ。REL-002本体のブロッカー（デプロイ実行アカウントが`設定用!B2`のCalendarへ書き込み権限を持たない、という権限設定の問題）そのものは未解消。`RELEASE_BLOCKER_CALENDAR_ACCESS.md`記載の運用手順（Calendar ID復元＋権限共有）は引き続き必須。REL-002のStatusは`[!]`のまま変更していない。
  - 検証完了後、隔離環境側に残っていたテスト用Script Properties7件は全件削除済み。
  - 詳細: `TASKS.md` REL-002・TDD-005各節、`RELEASE_BLOCKER_CALENDAR_ACCESS.md`の「Update 2026-08-09」節。

- **本番Script Propertiesの整理**: ユーザー指示により本番Script Properties（36件）を棚卸し。ユーザー承認を得たうえで、正常完了済み申込みの冪等性キー24件（`CHAT_SENT_*` `EVALUATION_FILE_*` `INDEX_ROW_*` `MAIL_SENT_*`）と、本番に誤って残置されていた隔離テスト用リソース5件（`TEST_*`、実メールアドレスを含むものあり）の計29件を削除した。
  - 削除せず保留にした3件: `CHAT_SENT_*`のみ存在し、評価シート・index・メール送信のキーが存在しない2026-06-30付の申込み3件。旧不具合発生期間と一致するため、該当講師への評価シート発行が実際に完了しているかどうかの確認が別途必要（未着手、ユーザー判断待ち）。
  - 詳細: `TASKS.md` OPS-003節。

- **ロゴ画像URLの補完**: 本番フォームにロゴが表示されない状態だったのは、`code.js`/`index.html`側の実装（`LOGO_IMAGE_URL`をScript Propertiesから読み込みテンプレート表示する仕組み）はすでに完成していたが、肝心のScript Property自体が未設定だったため。値の履歴はGit管理外のため、いつ・なぜ空になったかは特定できなかった。ユーザーから正しい値の提供を受け、本番`LOGO_IMAGE_URL`へ設定した。コード変更は不要だった。新規デプロイも不要（Script Propertiesは`doGet()`実行時に都度読み込まれるため）。

## 2026-08-08 更新: Google Docs正本との整合性確認とGitHub文書構成の同期

- Google Docs正本「タダスク講師を始めてみたい人の申込みフォーム・仕様書」の各タブ（追加仕様書ルート、SOW、RD、TRD、データ・インターフェース定義書、メール本文）を実装・GitHub側文書と突き合わせ、相違を確認・修正した。
- Google Docs側で見つかり修正した相違: 実行モデル（申込者実行→デプロイ担当者実行）の記述が複数タブに残存、indexシートA列への書込み前提（実際はArrayFormula維持のため書込み禁止）、評価シートの保存先（申込者マイドライブ→共有フォルダ）、ログへのメールアドレス出力前提（個人情報保護方針と矛盾）、評価シートファイル名の★欠落、メール本文プレースホルダーが`[タグ]`形式のまま（本番スプレッドシートは`{{タグ}}`形式へ既に修正済みだが、Google Docs側のみ未更新だった）。
- 上記はすべてGoogle Docs側を編集して解消済み（実装・本番設定側の変更は行っていない）。
- GitHub側に`SOW.md`、`RD.md`、`TRD.md`を新規作成し、Google Docsのタブ構成に対応させた。`SPEC.md`は「データ・インターフェース定義書」タブに対応する位置づけとし、`SPEC.md` 2節のタブ対応表を更新した。
- 実施した変更はいずれもドキュメントのみ。`code.js`等の実装・本番Apps Script・本番スプレッドシートには一切変更を加えていない。

## 2026-08-08 更新: 評価シート発行の重複・孤立コピー不具合を修正

- 不具合1: 同一講師が連続で申込むと、評価シート発行がファイル名一致による探索（`findEvaluationFileByName_`、未仕様の実装）で過去のファイル（ゴミ箱内含む）を誤って発見し、権限付与に失敗していた。`findEvaluationFileByName_`を削除し、`submissionId`のみを冪等キーとする仕様（`SPEC.md` 7.3節）に一本化した。同一講師の再申込では、ファイル名が重複していても新しい評価シートを発行する（既存ファイルは削除しない）。
- 不具合2: 評価シートのコピー成功後に権限付与だけが失敗すると、冪等キーが保存されず、再実行のたびに孤立したコピーが増え続けていた。冪等キーをコピー直後（権限付与の前）に保存するよう修正し、再実行時は同じコピーの権限だけを再試行するようにした。
- 不具合3: 冪等キーが指すファイルがゴミ箱に移動されていても、`DriveApp.getFileById`は例外にならないため誤って成功扱いになっていた。ゴミ箱内であれば`EVALUATION_COPY_FAILED`として失敗させるよう修正した。
- 対応ファイル: `code.js`（`provisionEvaluationSheet_`）、`tests/evaluation_provisioning.test.mjs`（EVAL-009〜012追加）、`tests/flow_orchestration.test.mjs`（E2E-EVAL-001/002追加、スタブでない実装を`saveFormData`全体フローで検証）。
- ドキュメント: `SPEC.md` 7.3節、`RUNBOOK.md`（評価シート発行失敗・重複確認表）、`TASKS.md` IMP-002、`TEST_CASES.md`を実装と一致するよう更新。
- 未対応（別件、対応不要）: index シートG列以降の数式複製漏れ（`REQ-IDX-002`）を発見したが、スプレッドシート側でMAP関数を使って対応する方針のため、コード修正は行っていない。`docs/PROJECT_SPEC.md`等の作成は行っていない（未確定事項なし、既存`SPEC.md`が正本のため）。
- 検証: ローカルテスト71件成功、`clasp push --force`によるApps Script `@HEAD`更新は成功したが、`clasp run runDryTestSuite`によるリモートGASドライランはAPI executableの実行権限エラーで未実施（実行アカウントとデプロイ実行アカウントの不一致が疑われる。次担当者は権限設定を確認すること）。

## 2026-08-08 更新: メール設定とデプロイ保護

- `設定用!F2`（自動返信メール件名）と`G2`（本文）を、承認済みGoogleドキュメントの文面へ更新した。
- 本文の差し込み箇所は、`{{tadasukeName}}`、`{{evaluationSheetUrl}}`、`{{responseSummary}}`へ置換済み。旧プレースホルダーは残していない。
- メール送信とGoogle Chat通知のテストは、ユーザー報告により成功済みとして扱う。メール実送信の証跡、宛先、本文、Webhook URLは保存・共有しない。
- 記録済みの既存production web-app deploymentは、今後いかなる場合も更新・置換しない。検証が必要な場合は、対象・影響範囲・ロールバック・検証方法についてユーザー承認を得たうえで、別の新規test deploymentを作成する。
- デプロイ前チェックからコンテンツハッシュ照合を廃止した。保護ファイルの存在、承認済みtracked files、ignore規則は引き続き検査し、保護ファイルの内容変更は`git diff`で明示レビューする。
- この変更後、ローカルテストは65件成功・0件失敗、`node scripts/check-deployment.mjs`は`ok: true`を確認済み。

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
4. Apps Script へ push する前に、`node --test tests/*.test.mjs`、`node scripts/check-deployment.mjs`、`clasp status --user default` を実行する。保護ファイルに差分がある場合は、理由と影響範囲を`git diff`でレビューする。
5. production に関わる操作では、`.local/OPERATIONS.md` と実際の `clasp deployments` を照合し、実値を Git・チャット・証跡へ出さない。記録済みの既存production deploymentは更新せず、必要時は新規test deploymentだけを作成する。

## 未実施・要確認事項

- 現在の production/test deployment、Script Properties、実行アカウントは、この引継ぎでは再確認していない。調査・変更・デプロイ時に実測すること。
- `TASKS.md` REL-002 と `RELEASE_BLOCKER_CALENDAR_ACCESS.md` は 2026-06-18 JST 時点の rollback 記録のまま更新されていないが、`code.js`（`saveFormData`、既存予定の更新失敗時に新規作成へフォールバックする処理）には、その原因に対応するとみられる修正が既に含まれている（記録済みコミット履歴からは修正時期を特定できない。当時の作業ログが本リポジトリ外にある可能性がある）。この修正でREL-002のブロッカーが解消するかは未検証・未判断。本番反映を検討する前に、非本番環境で「更新対象イベントIDが存在しない」ケースを再現し、フォールバックが機能することを確認したうえで、`TASKS.md`/`RELEASE_BLOCKER_CALENDAR_ACCESS.md`を実態に合わせて更新すること。
- 未コミット変更がある場合はレビュー・コミットしてからGitHubへpushする。通常は `git push origin main` を使い、認証変更・強制push・履歴書換えを行わない。

## 機密情報の扱い

`.local/`、OAuth 関連、Webhook URL、実ID、実URL、個人情報、raw logs は GitHub に置かない。必要な実運用情報は `.local/OPERATIONS.md` にだけ記録し、値ではなくキー名・状態・確認日時を共有する。
