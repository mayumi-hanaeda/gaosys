// /**
//  * @fileoverview タダスク講師申し込みフォームのバックエンド処理
//  * @version 1.0.0
//  */

// // =================================================================
// // 定数定義
// // =================================================================
// /** @const {string} 対象スプレッドシートのID */
// const SPREADSHEET_ID = 'YOUR_PRODUCTION_SPREADSHEET_ID';

// /** @const {string} 講師名のマスターデータが格納されているシート名 */
// const MASTER_SHEET_NAME = '名前リスト';

// /** @const {string} フォームからの投稿データを保存するシート名 */
// const SUBMISSION_SHEET_NAME = '申込リスト';


// // =================================================================
// // エントリーポイント
// // =================================================================
// /**
//  * HTTP GETリクエストに対するエントリーポイント。
//  * Vue.jsで構築されたフロントエンドHTMLを返します。
//  * @param {GoogleAppsScript.Events.DoGet} e - イベントオブジェクト
//  * @returns {GoogleAppsScript.HTML.HtmlOutput} 描画するHTMLオブジェクト
//  */
// function doGet(e) {
//   const functionName = 'doGet';
//   console.log(JSON.stringify({
//     message: 'GETリクエスト受信',
//     functionName: functionName,
//     parameters: e.parameter
//   }));

//   try {
//     return HtmlService.createTemplateFromFile('index').evaluate()
//       .setTitle('タダスク講師 申込みフォーム')
//       .addMetaTag('viewport', 'width=device-width, initial-scale=1');
//   } catch (error) {
//     console.error(JSON.stringify({
//       message: 'HTMLファイルの描画に失敗しました。',
//       functionName: functionName,
//       error: error.toString(),
//       stack: error.stack
//     }));
//     // ユーザーにはシンプルなエラーページを表示
//     return HtmlService.createHtmlOutput('<h1>エラーが発生しました</h1><p>ページの読み込みに失敗しました。管理者にお問い合わせください。</p>');
//   }
// }


// // =================================================================
// // フロントエンドから呼び出される関数
// // =================================================================
// /**
//  * 講師のマスターデータをスプレッドシートから取得し、フロントエンドに返します。
//  * サジェスト機能のために使用されます。
//  * @returns {Array<Object>} 講師データの配列。各オブジェクトは { fullName, hiragana, nickname } を持つ。
//  * @throws {Error} データの取得に失敗した場合にエラーをスローします。
//  */
// function getMasterData() {
//   const functionName = 'getMasterData';
//   console.log(JSON.stringify({
//     message: 'マスターデータの取得処理を開始',
//     functionName: functionName
//   }));

//   try {
//     const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
//     const sheet = ss.getSheetByName(MASTER_SHEET_NAME);

//     if (!sheet) {
//       throw new Error(`シート「${MASTER_SHEET_NAME}」が見つかりません。`);
//     }

//     const lastRow = sheet.getLastRow();
//     if (lastRow < 2) {
//       console.log(JSON.stringify({
//         message: 'マスターデータが空です。ヘッダー行のみ存在します。',
//         functionName: functionName,
//         sheetName: MASTER_SHEET_NAME
//       }));
//       return []; // データがなければ空配列を返す
//     }
    
//     // getValues()で2次元配列としてデータを取得 (2行目, A列から, 最終行-1行分, F列まで)
//     const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
//     const values = dataRange.getValues();
    
//     console.log(JSON.stringify({
//       message: `${values.length}件のマスターデータを取得しました。`,
//       functionName: functionName
//     }));

//     // フロントエンドで使いやすいように、配列内の各行をオブジェクトに変換
//     const nameList = values.map(row => {
//       return {
//         fullName: row[0], // A列: フルネーム
//         hiragana: katakanaToHiragana(`${row[3]} ${row[4]}`), // D列+E列のフリガナをひらがな化
//         nickname: row[5]  // F列: ニックネーム
//       };
//     });

//     console.log(JSON.stringify({
//       message: 'マスターデータの整形処理が完了',
//       functionName: functionName
//     }));
//     return nameList;

//   } catch (error) {
//     console.error(JSON.stringify({
//       message: 'マスターデータの取得中に致命的なエラーが発生しました。',
//       functionName: functionName,
//       error: error.toString(),
//       stack: error.stack
//     }));
//     // フロントエンドの withFailureHandler で捕捉されるようにエラーをスローする
//     throw new Error('サーバー側でマスターデータの取得に失敗しました。');
//   }
// }


// /**
//  * フロントエンドから送信されたフォームデータをスプレッドシートに保存します。
//  * @param {Object} formData - フロントエンドのフォーム入力データオブジェクト
//  * @returns {Object} 処理結果を示すオブジェクト { success: boolean, message: string }
//  */
// function saveFormData(formData) {
//   const functionName = 'saveFormData';
//   // ログに個人情報を含めないように配慮する場合、特定のフィールドをマスクする処理を追加するとより良い
//   console.log(JSON.stringify({
//     message: 'フォームデータ保存処理を開始',
//     functionName: functionName,
//     receivedData: formData
//   }));
  
//   try {
//     const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
//     let sheet = ss.getSheetByName(SUBMISSION_SHEET_NAME);

//     // シートが存在しない場合は、ヘッダー付きで新規作成する
//     if (!sheet) {
//       console.log(JSON.stringify({
//         message: `シート「${SUBMISSION_SHEET_NAME}」が存在しないため、新規作成します。`,
//         functionName: functionName
//       }));
//       sheet = initializeSubmissionSheet(ss);
//     }
    
//     // スプレッドシートに書き込む行データを作成
//     const newRow = [
//       new Date(), // タイムスタンプ
//       Session.getActiveUser().getEmail(), // 申込者メールアドレス
//       formData.mainCheck, // 希望する内容
//       formData.mainCheckOther, // その他詳細
//       formData.name, // お名前
//       formData.tadasukeName, // タダスクネーム
//       formData.startTime, // 希望開始時期
//       formData.challenge, // チャレンジ講師 (true/false)
//       formData.freeText // 自由記載
//     ];

//     sheet.appendRow(newRow);
    
//     console.log(JSON.stringify({
//       message: 'フォームデータのスプレッドシートへの書き込みが成功しました。',
//       functionName: functionName,
//       appendedRow: newRow
//     }));

//     return { success: true, message: '申し込みを受け付けました。ありがとうございます。' };

//   } catch (error) {
//     console.error(JSON.stringify({
//       message: 'フォームデータの保存中に致命的なエラーが発生しました。',
//       functionName: functionName,
//       error: error.toString(),
//       stack: error.stack
//     }));
//     return { success: false, message: 'サーバーエラーにより、申し込みを保存できませんでした。' };
//   }
// }

// // =================================================================
// // ヘルパー関数
// // =================================================================
// /**
//  * 申込データ保存用のシートを初期化（新規作成）します。
//  * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - 対象のスプレッドシートオブジェクト
//  * @returns {GoogleAppsScript.Spreadsheet.Sheet} 作成されたシートオブジェクト
//  */
// function initializeSubmissionSheet(spreadsheet) {
//   const sheet = spreadsheet.insertSheet(SUBMISSION_SHEET_NAME);
//   const headers = [
//     'タイムスタンプ', '申込者メールアドレス', '希望する内容', 'その他詳細', 
//     'お名前', 'タダスクネーム', '希望開始時期', 'チャレンジ講師', '自由記載'
//   ];
//   sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
//   sheet.setFrozenRows(1); // ヘッダー行を固定
//   return sheet;
// }

// /**
//  * 文字列内のカタカナをひらがなに変換します。
//  * @param {string} str - 変換対象の文字列
//  * @returns {string} 変換後の文字列
//  */
// function katakanaToHiragana(str) {
//   if (!str) return '';
//   return str.replace(/[\u30A1-\u30F6]/g, (match) => {
//     return String.fromCharCode(match.charCodeAt(0) - 0x60);
//   });
// }
