# Current System Baseline

Updated: 2026-06-13
Status: Approved baseline for DOC-001

## Purpose

オンボーディング自動化を追加する前の現行動作を固定する。後続変更では、本書の回帰確認項目を満たし、意図して変更する挙動は`DECISIONS.md`と`SPEC.md`へ記録する。

## System Boundary

- Container-bound Google Apps Script
- Bound spreadsheet ID: `YOUR_PRODUCTION_SPREADSHEET_ID`
- Apps Script ID: `YOUR_PRODUCTION_APPS_SCRIPT_ID`
- Runtime: V8
- Time zone: `Asia/Tokyo`
- Web app execution: deploying user
- Web app access: domain users

現行アプリケーションソースは次の3ファイルを中心とする。

- `code.js`: Webエントリーポイント、名前マスター取得、申込保存、Calendar/Meet連携
- `index.html`: Vue 3フォーム、入力検証、候補日生成
- `チャット通知Bot.js`: 申込行のGoogle Chat通知

`ヤススさん*`、`のぐっちさん*`、`無題.js`は現行仕様の基準にしない。

## External Dependencies

| Dependency | Purpose | Current access |
| --- | --- | --- |
| SpreadsheetApp | マスター、設定、申込データ | 固定Spreadsheet IDまたはactive spreadsheet |
| CalendarHandler v4 | Calendar予定作成・更新、Meet追加 | Apps Script library |
| Google Calendar API v3 | Calendar関連 | Advanced Service enabled |
| UrlFetchApp | Google Chat webhook送信 | Script Property `CHAT_WEBHOOK_URL` |
| PropertiesService | Chat設定、通知の最終処理行 | `CHAT_WEBHOOK_URL`、`LAST_PROCESSED_ROW` |
| Session | 申込者メール、タイムゾーン | `getActiveUser()`、script time zone |
| HtmlService | Webフォーム配信 | `index.html` template |
| Vue 3 | WebフォームUI | unpkg CDN |

現時点では`DriveApp`、`MailApp`、`GmailApp`を現行フローで使用していない。

## Spreadsheet Contract

### 名前リスト

`getMasterData()`は2行目以降のA〜F列を読み込む。

| Column | Meaning | Returned field |
| --- | --- | --- |
| A | フルネーム | `fullName` |
| B | 姓 | 未使用 |
| C | 名 | 未使用 |
| D | フリガナ（姓） | `hiragana`の生成元 |
| E | フリガナ（名） | `hiragana`の生成元 |
| F | ニックネーム | `nickname` |

D・E列は結合後、カタカナからひらがなへ変換する。データ行がなければ空配列を返す。

### 設定用

| Cell | Meaning | Current behavior |
| --- | --- | --- |
| A2 | Calendarタイトル | CalendarHandlerへ渡す |
| B2 | Calendar ID | CalendarHandlerへ渡す |
| C2 | 所要時間（分） | CalendarHandlerへ渡す |
| D2 | 開始時刻 | 空の場合は`20:00` |

D2がDateならscript time zoneで`HH:mm`へ変換し、それ以外の非空値は文字列として使用する。

### 申込リスト

現行GASはA〜I列へ追記する。H/I列を現行仕様の正とし、旧仕様のJ/K列は使用しない。

| Column | Header | Written value |
| --- | --- | --- |
| A | タイムスタンプ | サーバー現在時刻 |
| B | 申込者メールアドレス | `Session.getActiveUser().getEmail()` |
| C | お名前 | `formData.name` |
| D | タダスクネーム | `formData.tadasukeName` |
| E | 希望開始時期 | `yyyy年MM月dd日（E）` |
| F | チャレンジ講師 | 希望する／希望しないの文言 |
| G | 自由記載 | `formData.freeText` |
| H | カレンダーID | CalendarHandlerが返したevent ID |
| I | 開催日時Data | Date |

シートが存在しない場合、`initializeSubmissionSheet()`がA〜O列の15列ヘッダーを作成する。ただし通常の申込保存が書き込むのはA〜I列のみ。

### index

現行申込処理からは書き込まない。2026-06-13にログイン済みの実シートを読み取り確認した結果:

- A1は卒業表示を生成する`ArrayFormula`であり、データ行のA列へ直接書き込んではならない。
- B列「名前（敬称略）」の実データはタダスクネームで運用されている。
- C列「新講師就任年月」は日付値だが、空欄の既存行もある。
- D列はサポーター、E列はサブ担当者であり、新規作成時は未定なら空欄。
- F列「シート」は評価シートへのリンク。
- G列以降には評価シートを参照する数式があり、少なくとも次の空行まで事前配置されている。

ベースライン確認時点ではC列の初期値と数式行の確保方法が未確定だった。現在の確定仕様は`DECISIONS.md`と`SPEC.md`を参照する。

## Web Form Contract

### Input

```json
{
  "name": "申込者のフルネーム",
  "tadasukeName": "タダスクネーム",
  "startTime": "YYYY-MM-DD",
  "challenge": false,
  "freeText": "任意入力"
}
```

必須条件:

- `name`が空でない
- `name`が名前マスターの`fullName`と完全一致する
- `tadasukeName`が空でない
- `startTime`が選択済み

名前入力ではフルネームの部分一致、またはひらがな化したフリガナの部分一致で最大5件を表示する。候補選択時に氏名とニックネームを設定する。

### Candidate Dates

ブラウザ時刻を基準に、未来の第3月曜日を3件生成する。当日の第3月曜日は現在時刻より後という条件を満たさないため候補に含まれない。

表示形式は`YYYY年M月D日(月)`、送信形式は`YYYY-MM-DD`。

### Response

成功:

```json
{
  "success": true,
  "message": "申し込みを受け付けました。ありがとうございます。"
}
```

失敗:

```json
{
  "success": false,
  "message": "サーバーエラーにより、申し込みを保存できませんでした。"
}
```

成功時はフォームを非表示にする。通信失敗時はブラウザへエラーメッセージを表示する。

## Current Processing Flow

1. `doGet()`が`index.html`を返す。
2. UIのmount時に`getMasterData()`を呼び、候補日を生成する。
3. 有効なフォームだけ`saveFormData(formData)`へ送信する。
4. `設定用!A2:D2`を読み、開催日時を生成する。
5. `申込リスト!H:I`を全行走査し、同一開催日時のevent IDを探す。
6. event IDがあればCalendar予定を更新し、なければ新規作成する。
7. 新規イベントの場合のみMeetリンクを追加する。
8. `申込リスト!A:I`へ新しい行を追記する。
9. `handleSheetChange()`を直接呼び、未通知行をGoogle Chatへ送る。
10. UIへ成功または失敗を返す。

## Google Chat Contract

`LAST_PROCESSED_ROW`より後ろの全行を順番に処理する。

通知対象:

- B列: 申込者メールアドレス
- C列: お名前
- D列: タダスクネーム
- E列: オリエンテーション参加日
- F列: チャレンジ講師
- G列: 自由記載

空セルは通知本文から除外し、末尾へ管理スプレッドシートURLを追加する。処理後に`LAST_PROCESSED_ROW`を現在の最終行へ更新する。

## Known Current Behaviors and Risks

以下は現行挙動であり、後続実装で維持する要件ではない。変更時はテストと決定記録を更新する。

- `saveFormData()`開始ログにフォーム入力全体が含まれ、氏名・自由記載などの個人情報が出力される。
- Chat Webhookは2026-06-15にローテーション済みで、Script Propertiesから取得する。
- Chat送信は`muteHttpExceptions: true`でHTTP 2xxだけを成功として扱う。
- Chat送信例外は内部で捕捉されるため、Chat失敗でも申込処理は成功を返し得る。
- `handleSheetChange()`は送信成否に関係なく最終処理行を更新し得る。
- Calendar操作後に申込行追記が失敗すると、Calendar予定だけ残る。
- 同一日時の再申込ではCalendar予定を更新するが、申込行は毎回追加する。
- 同一日時の判定は申込者ではなく開催日時だけをキーにする。
- Calendar重複検索とChat未処理行取得は行数に比例する。
- `saveFormData()`にはサーバー側の名前マスター照合や文字数制限がない。
- `testSendNotification()`はドライランではなく、実際のWebhookへ送信する。
- Chat処理はactive spreadsheet、申込処理は固定Spreadsheet IDを使用している。
- ローカル単体テスト、書き込みなしGASドライテスト、`MYSELF`限定のAPI
  executable、Cloud Logging取得基盤を整備済みである。
- 2026-06-16に`設定用!E2:G2`と`EVALUATION_SHEET_FOLDER_ID`を追加し、
  `getApplicationConfigurationStatus`は`ok: true`を返す。設定値自体は
  ログ・証跡へ保存していない。
- 実シートの`申込リスト!J:R`は2026-06-13時点でヘッダーが空欄だが、初期化コード上はJ〜O列が既存運用予約列である。

## Regression Checklist

### Static

- [ ] `code.js`と`チャット通知Bot.js`に構文エラーがない
- [ ] `appsscript.json`のV8、Asia/Tokyo、CalendarHandler v4が意図せず変更されていない
- [ ] 現行対象外のレガシーファイルに変更がない
- [ ] `clasp status`のpush対象がレビュー済みである

### Master and UI

- [ ] `getMasterData()`が氏名、ひらがなフリガナ、ニックネームを返す
- [ ] 名前候補が最大5件表示される
- [ ] 候補選択で氏名とタダスクネームが設定される
- [ ] マスターにない氏名では送信できない
- [ ] 未来の第3月曜日が3件表示される
- [ ] 送信中はボタンが無効になる
- [ ] 成功時と失敗時に正しいメッセージが表示される

### Submission and Calendar

- [ ] `設定用!A2:D2`が読み込まれる
- [ ] D2空欄時に20:00を使う
- [ ] 新規日時でCalendar予定を作成する
- [ ] 新規予定だけMeetリンクを追加する
- [ ] 同一日時で既存event IDを使用して予定を更新する
- [ ] `申込リスト!A:I`へ正しい順序と型で追記する
- [ ] H列がCalendar ID、I列が開催日時Dataのままである

### Chat

- [ ] 未処理行だけを通知対象にする
- [ ] B〜G列の非空値が通知本文へ入る
- [ ] 管理スプレッドシートURLが通知へ入る
- [ ] 処理後に`LAST_PROCESSED_ROW`が更新される

## Baseline Approval

DOC-001の完了条件:

- 現行フロー、対象シート、列、外部サービスを本書へ記録済み
- `申込リスト` H/I列を正として明記済み
- 現行機能の回帰確認項目を記録済み
