# Incident Recovery Runbook

Updated: 2026-08-08

## Purpose

申込受付、Calendar、評価シート、`index`、Chat、メールの部分失敗を、
重複生成や個人情報漏えいを避けながら復旧する。

## Safety Rules

1. 利用者へフォームの再送を依頼する前に、既存成果物を確認する。
2. 証跡には日時、`submissionId`、行番号、エラーコード、処理状態だけを残す。
3. メールアドレス、自由記載、Webhook URL、メール本文、OAuth情報を証跡へ残さない。
4. 行、Calendar予定、Driveファイルを削除前に、所有者、日時、対応行を確認する。
5. 手動修正前に対象行または対象設定のバックアップを取得する。
6. 復旧再実行では同じsubmissionIdを使用し、新しいsubmissionIdを発行しない。

削除やプロパティ変更が必要な場合は開発者対応とし、運営担当者は実行しない。

## 現行本番の制約

`IMP-006`完了前の現行本番には、`submissionId`、P/Q状態列、評価シート、
`index`、自動返信メールの統合処理がまだない。現行フォームの再送は同じ日時の
Calendar予定を更新する一方、`申込リスト`へ新しい行を追加するため、完全な冪等
再実行ではない。

現行本番で申込保存またはCalendar処理に失敗した場合は、自動再送を行わず、
Calendar H/I列と対象日時の予定を照合して開発者へ連携する。`IMP-006`完了後は、
以下の`submissionId`ベースの手順を使用する。

## Initial Triage

1. 新規受付を止める必要がある障害か確認する。
2. `申込リスト`で対象行、H列Calendar ID、I列開催日時を確認する。
3. 実装後はP列`submissionId`、Q列の処理状態とエラーコードを確認する。
4. Calendar、評価シート保存先、`index`、Chat、送信済みメールを順に確認する。
5. `clasp logs`は画面で絞り込み、個人情報を含む全ログをファイル保存しない。
6. 下表で受付全体の成否を判定する。

| State | User-facing result | Recovery owner |
| --- | --- | --- |
| Calendarまたは申込保存が失敗 | 受付失敗 | developer |
| Calendarと申込保存が成功、追加処理が失敗 | 受付成功・部分失敗 | operator then developer |
| 全処理成功 | 受付成功 | none |

## Calendarだけ作成された

症状: Calendar予定またはMeetは存在するが、対応する`申込リスト!A:I`行がない。

1. Calendar予定の日時、タイトル、event IDを確認する。
2. 同じ日時の既存申込行がないかH/I列で確認する。
3. フォームの失敗時刻とCalendar予定の作成時刻が一致するか確認する。
4. 正当な申込か判断できない場合は予定を変更せず開発者へ連携する。
5. 不要な孤立予定と確定した場合だけ、削除前確認とバックアップ記録後に削除する。
6. 正当な申込の場合、現行本番では無条件再送しない。開発者が重複を確認して
   申込行を復旧するか、孤立予定削除後に1回だけ再受付する。
7. 実装後は同じ`submissionId`で再実行し、Calendar予定が1件、申込行が1件で
   あることを確認する。

完了条件: 対応するCalendar予定と申込行が各1件で、H列event IDとI列日時が一致。

## 評価シート発行失敗

対象コード: `EVALUATION_COPY_FAILED`、`EVALUATION_PERMISSION_FAILED`。

1. 申込保存とCalendarが成功していることを確認する。
2. `設定用!E2`と`EVALUATION_SHEET_FOLDER_ID`の存在・アクセス権を確認する。
3. `EVALUATION_FILE_{submissionId}`を確認する。冪等性キーはコピー成功直後（権限付与の前）に保存されるため、権限付与だけが失敗した場合もこのキーは同じコピーを指している。
4. キーが指すファイルがゴミ箱にある場合は、新規コピーへ差し替えず`EVALUATION_COPY_FAILED`として扱い、ファイルの復元またはキーの削除を開発者と判断する。
5. ゴミ箱でなければ、同じ`submissionId`で評価シート以降を再実行する。権限は毎回自動で再確認・再付与される。
6. 評価シート成功前はメールを送信しない。
7. Chatには「評価シート発行失敗・要手動対応」が通知されているか確認する。
8. 同一講師の再申込では、ファイル名が過去の評価シートと重複していても正常（申込単位で新しい評価シートを発行する仕様）。同名だけを理由にファイルを統合・削除しない。

完了条件: 対象`submissionId`の評価シートが1件、編集権限あり、URLが申込状態へ記録されている。

## index登録失敗

対象コード: `INDEX_WRITE_FAILED`。

1. 評価シート発行が成功していることを確認する。
2. `INDEX_ROW_{submissionId}`の有無を確認する。
3. `index` B列のタダスクネームとF列の評価シートリンクを検索する。
4. 対応行が既にあれば新規行を作らず、B〜F列とG列以降の数式を確認する。
5. 対応行がなければ、同じ`submissionId`でindex処理だけを再実行する。
6. A列のArrayFormulaを上書きせず、B〜F列が1行だけ追加されたことを確認する。

完了条件: `INDEX_ROW_{submissionId}`が実在する1行を指し、F列リンクが開ける。

## Chat通知失敗

対象コード: `CHAT_FAILED`。

1. `CHAT_WEBHOOK_URL`が設定済みかを値を表示せず確認する。
2. `CHAT_SENT_{submissionId}`と対象スペースを確認する。
3. 送信済みなら再送しない。
4. 未送信ならWebhookを修復し、同じ`submissionId`でChat処理だけを再実行する。
5. HTTP 200〜299と`CHAT_SENT_{submissionId}`の記録を確認する。

現行本番では失敗時も`LAST_PROCESSED_ROW`が進む可能性がある。プロパティを安易に
戻すと複数行を再送するため、運営担当者は変更しない。必要な通知を手動で1件だけ
投稿し、開発者へ対象行を連携する。

完了条件: 対象申込の通知が1件だけ存在し、Webhook値がログへ出ていない。

## メール送信失敗

対象コード: `MAIL_TEMPLATE_INVALID`、`MAIL_FAILED`。

1. 評価シートと編集権限が成功していることを確認する。
2. `MAIL_SENT_{submissionId}`と送信済みフォルダを確認する。
3. 送信済みなら再送しない。
4. `設定用!F2:G2`の空欄、未知タグ、未置換タグを確認する。
5. 設定または送信制限を修復し、同じ`submissionId`でメール処理だけを再実行する。
6. 宛先、件名、評価シートURLを受信箱で確認する。

完了条件: 対象メールが1通だけ届き、`MAIL_SENT_{submissionId}`が記録されている。

## 再実行前の重複確認

再実行前に次をすべて確認する。

| Target | Duplicate check |
| --- | --- |
| Calendar | H列event ID、I列日時、Calendar上の同日時予定 |
| Submission | P列`submissionId`の件数が1件 |
| Evaluation | `EVALUATION_FILE_{submissionId}`（同名ファイルの存在は重複の判断材料にしない） |
| index | `INDEX_ROW_{submissionId}`、B列名、F列リンク |
| Chat | `CHAT_SENT_{submissionId}`と対象スペースの通知 |
| Mail | `MAIL_SENT_{submissionId}`と送信済みメール |

1件でも状態が不明なら全体再実行をしない。成功済み処理を`skipped`として扱える
復旧経路だけを使用する。再実行後も各成果物が1件であることを再確認する。

## Escalation Record

開発者へ次だけを連携する。

- 発生日時と環境
- `submissionId`または現行本番の対象行番号
- エラーコード
- 各処理の`success`、`failed`、`skipped`
- 重複確認結果
- 実施した復旧操作

秘密値、個人情報、ログ全文、画面全体のスクリーンショットは添付しない。
