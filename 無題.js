// /**
//  * WebアプリのHTMLページを配信します。
//  * @param {GoogleAppsScript.Events.DoGet} e GETリクエストのイベントパラメータ。
//  * @returns {GoogleAppsScript.HTML.HtmlOutput} レンダリングされるHTML Output。
//  */
// function doGet(e) {
//   logToSheet('Webアプリがアクセスされました。');
//   // 'index.html'をUIとして配信します。
//   // include()関数がCSSコンテンツをHTMLに挿入します。
//   return HtmlService.createTemplateFromFile('index.html')
//       .evaluate()
//       .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
// }

// /**
//  * 他のファイル（CSSやJSなど）の内容をメインのHTMLファイルにインクルードします。
//  * これはGASでファイルを結合する際の標準的な方法です。
//  * @param {string} filename インクルードするファイル名。
//  * @returns {string} 指定されたファイルの内容。
//  */
// function include(filename) {
//   return HtmlService.createHtmlOutputFromFile(filename).getContent();
// }

// /**
//  * 送信されたフォームデータをGoogleスプレッドシートに保存します。
//  * @param {object} formData クライアントサイドのVueアプリからのフォームデータオブジェクト。
//  * @returns {string} 成功メッセージ。
//  */
// function saveData(formData) {
//   logToSheet('saveData関数の実行開始。');
//   try {
//     if (!formData || typeof formData !== 'object') {
//       throw new Error('無効なフォームデータがサーバーに送信されました。');
//     }

//     logToSheet('saveDataが呼び出されました。データ: ' + JSON.stringify(formData));
//     const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
//     if (!spreadsheet) {
//       throw new Error('このスクリプトはスプレッドシートに紐付けられていません。');
//     }
    
//     const sheetName = '申し込みリスト';
//     let sheet = spreadsheet.getSheetByName(sheetName);

//     // シートが存在しない場合は作成します。
//     if (!sheet) {
//       sheet = spreadsheet.insertSheet(sheetName);
//     }

//     const headers = ['タイムスタンプ', '希望', 'お名前', 'タダスクネーム', '準備開始時期', 'オプション', '自由記載'];
    
//     // シートが空の場合にヘッダー行を追加します。
//     if (sheet.getLastRow() < 1) {
//         sheet.appendRow(headers);
//     }

//     // 新しいフォームデータを新しい行として追加します。
//     const newRow = [
//       new Date(),
//       formData.wantsTadask ? 'はい' : 'いいえ',
//       formData.name,
//       formData.tadaskName,
//       formData.preparationDate,
//       formData.wantsOption ? 'はい' : 'いいえ',
//       formData.notes
//     ];

//     sheet.appendRow(newRow);

//     logToSheet('データが正常に保存されました。お名前: ' + formData.name);
//     return 'Data saved successfully!';
//   } catch (error) {
//     const errorMessage = error.message ? error.message : String(error);
//     const errorStack = error.stack ? error.stack : 'スタックトレースなし';
//     Logger.log('saveData Error: ' + errorMessage + ' Stack: ' + errorStack);
//     logToSheet('saveDataでエラーが発生しました: ' + errorMessage + ' | Stack: ' + errorStack);
//     // クライアントサイドのFailureHandlerでキャッチできるエラーをスローします。
//     throw new Error('スプレッドシートへの保存中にエラーが発生しました。詳細はサーバーログを確認してください。エラー: ' + errorMessage);
//   }
// }

// /**
//  * オートコンプリート機能のために、「名前リスト」シートから名前のリストを取得します。
//  * @returns {string[]} 名前の配列。
//  */
// function getNames() {
//   try {
//     logToSheet('getNamesが呼び出されました。');
//     const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
//     if (!spreadsheet) {
//       throw new Error('このスクリリプトはスプレッドシートに紐付けられていません。');
//     }
    
//     const sheetName = '名前リスト';
//     let sheet = spreadsheet.getSheetByName(sheetName);

//     // シートが存在しない場合は、サンプル値を入れて作成し、空の配列を返します。
//     if (!sheet) {
//       spreadsheet.insertSheet(sheetName).getRange("A1").setValue("ここに名前の候補を入力");
//       return [];
//     }

//     // シートは存在するが空の場合は、空の配列を返します。
//     if (sheet.getLastRow() < 1) {
//         return [];
//     }

//     // 最初の列からすべての値を取得します。
//     const range = sheet.getRange(1, 1, sheet.getLastRow(), 1);
//     const values = range.getValues();
    
//     // 値の2次元配列を1次元配列にフラット化し、空のセルを除外します。
//     const flatValues = [].concat.apply([], values);
//     return flatValues.filter(function(name) { return String(name).trim() !== ''; });
//   } catch (error) {
//     const errorMessage = error.message ? error.message : String(error);
//     Logger.log(errorMessage);
//     logToSheet('getNamesでエラーが発生しました: ' + errorMessage);
//     throw new Error('名前リストの取得中にエラーが発生しました。詳細はサーバーログを確認してください。');
//   }
// }

// /**
//  * 指定されたメッセージを「ログ」シートに記録します。
//  * @param {string} message 記録するログメッセージ。
//  */
// function logToSheet(message) {
//   try {
//     const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
//     if (!spreadsheet) {
//       Logger.log('スプレッドシートが見つかりません。ログメッセージ: ' + message);
//       return;
//     }
//     const sheetName = 'ログ';
//     let sheet = spreadsheet.getSheetByName(sheetName);

//     if (!sheet) {
//       sheet = spreadsheet.insertSheet(sheetName);
//       sheet.appendRow(['タイムスタンプ', 'メッセージ']); // ヘッダーを追加
//     }

//     sheet.appendRow([new Date(), message]);
//   } catch (e) {
//     const errorMessage = e.message ? e.message : String(e);
//     // ログシートへの書き込みに失敗した場合、デフォルトのロガーにフォールバックします。
//     Logger.log('シートへのログ記録に失敗しました。元のメッセージ: "' + message + '". エラー: ' + errorMessage);
//   }
// }
