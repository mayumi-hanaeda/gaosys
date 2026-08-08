/**
 * @fileoverview タダスク講師申し込みフォームのバックエンド処理。
 * フロントエンドからのリクエストを受け、スプレッドシートへのデータ保存とGoogleカレンダーへの予定登録を担う。
 * @version 3.0.0
 * @author [あなたの名前]
 * @license MIT
 * @dependson CalendarHandler - Googleカレンダー連携のために、識別子`CalendarHandler`でライブラリがインポートされている必要があります。
 */

// =================================================================
// 定数定義
// =================================================================
/** @const {string} 本番Spreadsheet IDを保存するScript Property名 */
const SPREADSHEET_ID_PROPERTY_KEY = 'GAOSYS_SPREADSHEET_ID';

/** @const {string} 対象スプレッドシートのID。公開リポジトリには実IDを含めない。 */
const SPREADSHEET_ID = '';

/** @const {string} 隔離検証時だけSpreadsheet IDを差し替えるScript Property名 */
const SPREADSHEET_ID_OVERRIDE_PROPERTY_KEY = 'GAOSYS_SPREADSHEET_ID_OVERRIDE';

/** @const {string} 講師名のマスターデータが格納されているシート名 */
const MASTER_SHEET_NAME = '名前リスト';

/** @const {string} フォームからの投稿データを保存するシート名 */
const SUBMISSION_SHEET_NAME = '申込リスト';

/** @const {string} カレンダー連携用の設定が格納されているシート名 */
const SETTINGS_SHEET_NAME = '設定用';

/** @const {string} サポート状況管理用のindexシート名 */
const INDEX_SHEET_NAME = 'index';

const APPLICATION_CONFIGURATION_PROPERTY_KEYS = {
  chatWebhookUrl: 'CHAT_WEBHOOK_URL',
  evaluationFolderId: 'EVALUATION_SHEET_FOLDER_ID',
  logoImageUrl: 'LOGO_IMAGE_URL'
};
const RUNTIME_CONFIG_CONFIRM_TOKEN = 'CONFIGURE:RUNTIME-PROPERTIES';

function getApplicationSpreadsheetId_() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const overrideId = properties.getProperty(
      SPREADSHEET_ID_OVERRIDE_PROPERTY_KEY
    );
    if (overrideId && String(overrideId).trim() !== '') {
      return String(overrideId).trim();
    }
    const configuredId = properties.getProperty(SPREADSHEET_ID_PROPERTY_KEY);
    if (configuredId && String(configuredId).trim() !== '') {
      return String(configuredId).trim();
    }
  } catch (error) {
    // Property access can fail in limited test contexts; preserve fallback below.
  }
  if (SPREADSHEET_ID && String(SPREADSHEET_ID).trim() !== '') {
    return String(SPREADSHEET_ID).trim();
  }
  throw new Error('GAOSYS_SPREADSHEET_ID is not configured.');
}

function getConfiguredLogoImageUrl_() {
  try {
    return String(
      PropertiesService.getScriptProperties()
        .getProperty(APPLICATION_CONFIGURATION_PROPERTY_KEYS.logoImageUrl) ||
      ''
    ).trim();
  } catch (error) {
    return '';
  }
}

/**
 * 本番実行に必要な非秘密設定をScript Propertiesへ保存する。
 * 値は戻り値やログに含めない。
 * @param {{confirmToken: string, spreadsheetId: string,
 *   logoImageUrl?: string, supportStatusSpreadsheetUrl?: string}} options
 * @returns {{ok: boolean, configuredKeys?: string[], errorCode?: string}}
 */
function configureRuntimeProperties(options) {
  const input = options || {};
  if (input.confirmToken !== RUNTIME_CONFIG_CONFIRM_TOKEN) {
    return { ok: false, errorCode: 'CONFIRMATION_REQUIRED' };
  }

  const spreadsheetId = String(input.spreadsheetId || '').trim();
  if (!spreadsheetId) {
    return { ok: false, errorCode: 'SPREADSHEET_ID_REQUIRED' };
  }

  const properties = PropertiesService.getScriptProperties();
  const configuredKeys = [];
  properties.setProperty(SPREADSHEET_ID_PROPERTY_KEY, spreadsheetId);
  configuredKeys.push(SPREADSHEET_ID_PROPERTY_KEY);

  const logoImageUrl = String(input.logoImageUrl || '').trim();
  if (logoImageUrl) {
    if (!/^https:\/\/\S+$/.test(logoImageUrl)) {
      return { ok: false, errorCode: 'INVALID_LOGO_IMAGE_URL' };
    }
    properties.setProperty(
      APPLICATION_CONFIGURATION_PROPERTY_KEYS.logoImageUrl,
      logoImageUrl
    );
    configuredKeys.push(APPLICATION_CONFIGURATION_PROPERTY_KEYS.logoImageUrl);
  }

  const supportStatusSpreadsheetUrl = String(
    input.supportStatusSpreadsheetUrl || ''
  ).trim();
  if (supportStatusSpreadsheetUrl) {
    if (!/^https:\/\/\S+$/.test(supportStatusSpreadsheetUrl)) {
      return {
        ok: false,
        errorCode: 'INVALID_SUPPORT_STATUS_SPREADSHEET_URL'
      };
    }
    properties.setProperty(
      'SUPPORT_STATUS_SPREADSHEET_URL',
      supportStatusSpreadsheetUrl
    );
    configuredKeys.push('SUPPORT_STATUS_SPREADSHEET_URL');
  }

  return { ok: true, configuredKeys };
}


// =================================================================
// エントリーポイント
// =================================================================
/**
 * HTTP GETリクエストに対するエントリーポイント。
 * Vue.jsで構築されたフロントエンドHTMLを返します。
 * @param {GoogleAppsScript.Events.DoGet} e - Apps Scriptから渡されるイベントオブジェクト。
 * @returns {GoogleAppsScript.HTML.HtmlOutput} 描画するHTMLオブジェクト。
 */
function doGet(e) {
  const functionName = 'doGet';
  console.log(JSON.stringify({
    message: 'GETリクエスト受信',
    functionName: functionName,
    status: 'START',
    details: { parameters: e.parameter }
  }));

  try {
    const template = HtmlService.createTemplateFromFile('index');
    template.logoImageUrl = getConfiguredLogoImageUrl_();
    const htmlOutput = template.evaluate()
      .setTitle('タダスク講師 申込みフォーム')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    
    console.log(JSON.stringify({
      message: 'HTMLの描画に成功しました。',
      functionName: functionName,
      status: 'SUCCESS'
    }));
    return htmlOutput;

  } catch (error) {
    console.error(JSON.stringify({
      message: 'HTMLファイルの描画中に致命的なエラーが発生しました。',
      functionName: functionName,
      status: 'ERROR',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }));
    // ユーザーにはシンプルなエラーページを表示し、技術的な詳細は漏洩させない
    return HtmlService.createHtmlOutput('<h1>サーバーエラー</h1><p>ページの読み込みに失敗しました。管理者にお問い合わせください。</p>');
  }
}


// =================================================================
// フロントエンドから呼び出される関数
// =================================================================
/**
 * 講師のマスターデータをスプレッドシートから取得し、フロントエンドに返します。
 * 講師名入力のサジェスト機能のために使用されます。
 * @returns {Array<Object>} 講師データの配列。各オブジェクトは { fullName: string, hiragana: string, nickname: string } を持つ。
 * @throws {Error} データの取得に失敗した場合、クライアント側にエラーを通知します。
 */
function getMasterData() {
  const functionName = 'getMasterData';
  console.log(JSON.stringify({ message: 'マスターデータ取得処理を開始', functionName, status: 'START' }));

  try {
    const ss = SpreadsheetApp.openById(getApplicationSpreadsheetId_());
    const sheet = ss.getSheetByName(MASTER_SHEET_NAME);

    if (!sheet) {
      throw new Error(`設定不備: シート「${MASTER_SHEET_NAME}」が見つかりません。`);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log(JSON.stringify({
        message: 'マスターデータは空です（ヘッダー行のみ）。',
        functionName, status: 'INFO'
      }));
      return []; // データがなければ空配列を返すのが正常動作
    }
    
    // 範囲を6列目まで取得
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = dataRange.getValues();
    
    const nameList = values.map(row => ({
      fullName: row[0] || '',
      hiragana: katakanaToHiragana(`${row[3] || ''} ${row[4] || ''}`),
      nickname: row[5] || ''
    }));

    console.log(JSON.stringify({
      message: `マスターデータ ${nameList.length} 件の取得と整形が完了しました。`,
      functionName, status: 'SUCCESS'
    }));
    return nameList;

  } catch (error) {
    console.error(JSON.stringify({
      message: 'マスターデータの取得中に致命的なエラーが発生しました。',
      functionName, status: 'ERROR',
      error: { name: error.name, message: error.message, stack: error.stack }
    }));
    // フロントエンドには、より抽象的なエラーメッセージをスローする
    throw new Error('サーバー側でマスターデータの取得に失敗しました。');
  }
}

/**
 * 設定用シートとScript Propertiesからアプリケーション設定を取得する。
 * エラー結果とログには設定値を含めない。
 * @returns {{ok: boolean, value?: Object, errorCode?: string,
 *   missing?: string[], invalid?: string[]}}
 */
function loadApplicationConfiguration_() {
  const functionName = 'loadApplicationConfiguration_';

  try {
    const spreadsheet = SpreadsheetApp.openById(getApplicationSpreadsheetId_());
    const settingsSheet = spreadsheet.getSheetByName(SETTINGS_SHEET_NAME);
    if (!settingsSheet) {
      const unavailable = {
        ok: false,
        errorCode: 'CONFIG_SOURCE_UNAVAILABLE',
        missing: ['SETTINGS_SHEET'],
        invalid: []
      };
      logConfigurationResult_(functionName, unavailable);
      return unavailable;
    }

    const row = settingsSheet.getRange('A2:G2').getValues()[0] || [];
    const properties = PropertiesService.getScriptProperties();
    const result = GaosysDomain.normalizeConfiguration(
      {
        calendarTitle: row[0],
        calendarId: row[1],
        durationMinutes: row[2],
        startTime: row[3],
        evaluationTemplateId: row[4],
        mailSubjectTemplate: row[5],
        mailBodyTemplate: row[6]
      },
      {
        chatWebhookUrl: properties.getProperty(
          APPLICATION_CONFIGURATION_PROPERTY_KEYS.chatWebhookUrl
        ),
        evaluationFolderId: properties.getProperty(
          APPLICATION_CONFIGURATION_PROPERTY_KEYS.evaluationFolderId
        )
      }
    );

    logConfigurationResult_(functionName, result);
    return result;
  } catch (error) {
    const unavailable = {
      ok: false,
      errorCode: 'CONFIG_SOURCE_UNAVAILABLE',
      missing: [],
      invalid: []
    };
    logConfigurationResult_(functionName, unavailable);
    return unavailable;
  }
}

/**
 * 設定状態だけを返す。設定値や秘密情報は返さない。
 * @returns {{ok: boolean, errorCode: string|null,
 *   missing: string[], invalid: string[]}}
 */
function getApplicationConfigurationStatus() {
  const result = loadApplicationConfiguration_();
  return {
    ok: result.ok === true,
    errorCode: result.errorCode || null,
    missing: Array.isArray(result.missing) ? result.missing : [],
    invalid: Array.isArray(result.invalid) ? result.invalid : []
  };
}

/**
 * 評価シートを発行し、申込者へ編集権限を付与する。
 * 同じsubmissionIdで成功済みの場合は既存ファイルを再利用する。
 * @param {{submissionId: string, name: string, tadasukeName: string, email: string}} submission
 * @param {{evaluationTemplateId: string, evaluationFolderId: string}} configuration
 * @returns {{status: string, fileId?: string, fileName?: string, url?: string,
 *   reused: boolean, errorCode?: string}}
 */
function provisionEvaluationSheet_(submission, configuration) {
  const data = submission || {};
  const config = configuration || {};
  const propertyKey = buildEvaluationFilePropertyKey_(data.submissionId);
  const properties = PropertiesService.getScriptProperties();
  const existingFileId = properties.getProperty(propertyKey);
  const fileName = GaosysDomain.buildEvaluationSheetName(
    data.tadasukeName,
    data.name
  );

  let file;
  let reused = false;

  if (existingFileId) {
    try {
      file = DriveApp.getFileById(existingFileId);
    } catch (error) {
      return {
        status: 'failed',
        errorCode: 'EVALUATION_COPY_FAILED',
        reused: false
      };
    }

    if (typeof file.isTrashed === 'function' && file.isTrashed()) {
      return {
        status: 'failed',
        errorCode: 'EVALUATION_COPY_FAILED',
        reused: false
      };
    }
    reused = true;
  } else {
    try {
      const folder = DriveApp.getFolderById(config.evaluationFolderId);
      const template = DriveApp.getFileById(config.evaluationTemplateId);
      file = template.makeCopy(fileName, folder);
    } catch (error) {
      return {
        status: 'failed',
        errorCode: 'EVALUATION_COPY_FAILED',
        reused: false
      };
    }
    // 権限付与前に保存する。権限付与が失敗しても、再実行で同じコピーを
    // 再利用させ、コピーの孤立増殖を防ぐため。
    properties.setProperty(propertyKey, file.getId());
  }

  const permissionResult = grantEvaluationSheetEditor_(file, data.email);
  if (!permissionResult.ok) {
    return {
      status: 'failed',
      errorCode: 'EVALUATION_PERMISSION_FAILED',
      reused
    };
  }

  return {
    status: 'success',
    fileId: file.getId(),
    fileName,
    url: file.getUrl(),
    reused
  };
}

/**
 * 評価シートへ申込者の編集権限を付与する。
 * 既に編集権限を持つ場合は成功扱いにする。
 * @param {GoogleAppsScript.Drive.File} file
 * @param {string} email
 * @returns {{ok: boolean}}
 */
function grantEvaluationSheetEditor_(file, email) {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) return { ok: false };

  try {
    if (file.getEditors().some(editor =>
        editor.getEmail && editor.getEmail() === normalizedEmail
    )) {
      return { ok: true };
    }
  } catch (error) {
    // 権限一覧を読めない場合でも addEditor で判定する。
  }

  try {
    file.addEditor(normalizedEmail);
    return { ok: true };
  } catch (error) {
    return { ok: false };
  }
}

/**
 * 評価シート発行の冪等性キーを作る。
 * @param {string} submissionId
 * @returns {string}
 */
function buildEvaluationFilePropertyKey_(submissionId) {
  return `EVALUATION_FILE_${String(submissionId || '')
    .replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/**
 * indexシートへ評価シート情報を初期登録する。
 * @param {{submissionId: string, tadasukeName: string}} submission
 * @param {{fileName: string, url: string}} evaluationSheet
 * @returns {{status: string, row?: number, reused: boolean, errorCode?: string}}
 */
function registerIndexRow_(submission, evaluationSheet) {
  const data = submission || {};
  const sheetData = evaluationSheet || {};
  const rowData = GaosysDomain.buildIndexRowData({
    tadasukeName: data.tadasukeName,
    fileName: sheetData.fileName,
    url: sheetData.url
  });

  if (!rowData.link.url) {
    return {
      status: 'failed',
      errorCode: 'INDEX_WRITE_FAILED',
      reused: false
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const properties = PropertiesService.getScriptProperties();
    const propertyKey = buildIndexRowPropertyKey_(data.submissionId);
    const existingRow = Number(properties.getProperty(propertyKey));
    if (Number.isInteger(existingRow) && existingRow > 0) {
      return { status: 'success', row: existingRow, reused: true };
    }

    const spreadsheet = SpreadsheetApp.openById(getApplicationSpreadsheetId_());
    const indexSheet = spreadsheet.getSheetByName(INDEX_SHEET_NAME);
    if (!indexSheet) {
      return {
        status: 'failed',
        errorCode: 'INDEX_WRITE_FAILED',
        reused: false
      };
    }

    const targetRow = findFirstEmptyIndexRow_(indexSheet);
    indexSheet
      .getRange(targetRow, rowData.startColumn, 1, rowData.values.length)
      .setValues([rowData.values]);

    const richText = SpreadsheetApp.newRichTextValue()
      .setText(rowData.link.text)
      .setLinkUrl(rowData.link.url)
      .build();
    indexSheet
      .getRange(targetRow, rowData.startColumn + rowData.link.valueIndex)
      .setRichTextValue(richText);

    properties.setProperty(propertyKey, String(targetRow));
    return { status: 'success', row: targetRow, reused: false };
  } catch (error) {
    return {
      status: 'failed',
      errorCode: 'INDEX_WRITE_FAILED',
      reused: false
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * indexシートB列の最初の空行を取得する。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number}
 */
function findFirstEmptyIndexRow_(sheet) {
  const firstDataRow = 2;
  const lastRow = Math.max(sheet.getLastRow(), firstDataRow);
  const rowCount = lastRow - firstDataRow + 1;
  const values = sheet.getRange(firstDataRow, 2, rowCount, 1).getValues();

  for (let index = 0; index < values.length; index++) {
    const value = values[index][0];
    if (value === null || typeof value === 'undefined' ||
        String(value).trim() === '') {
      return firstDataRow + index;
    }
  }

  return lastRow + 1;
}

/**
 * index登録の冪等性キーを作る。
 * @param {string} submissionId
 * @returns {string}
 */
function buildIndexRowPropertyKey_(submissionId) {
  return `INDEX_ROW_${String(submissionId || '')
    .replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/**
 * 申込者へ自動返信メールを送信する。
 * 評価シート発行が成功していない場合は送信しない。
 * @param {{
 *   submissionId: string,
 *   email: string,
 *   name: string,
 *   tadasukeName: string,
 *   startDate: string,
 *   challenge: string,
 *   freeText: string
 * }} submission
 * @param {{url?: string}} evaluationSheet
 * @param {{mailSubjectTemplate: string, mailBodyTemplate: string}} configuration
 * @returns {{status: string, errorCode: string|null, reused: boolean}}
 */
function sendAcknowledgementMail_(submission, evaluationSheet, configuration) {
  const data = submission || {};
  const sheetData = evaluationSheet || {};
  const config = configuration || {};
  const evaluationSheetUrl = String(sheetData.url || '').trim();

  if (!evaluationSheetUrl) {
    return { status: 'skipped', errorCode: null, reused: false };
  }

  const propertyKey = buildMailSentPropertyKey_(data.submissionId);
  if (!propertyKey) {
    return { status: 'failed', errorCode: 'MAIL_FAILED', reused: false };
  }

  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(propertyKey)) {
    return { status: 'success', errorCode: null, reused: true };
  }

  const values = {
    name: data.name,
    tadasukeName: data.tadasukeName,
    startDate: data.startDate,
    challenge: data.challenge,
    freeText: data.freeText,
    evaluationSheetUrl
  };
  const subject = GaosysDomain.renderMailTemplate(
    config.mailSubjectTemplate,
    values
  );
  const body = GaosysDomain.renderMailTemplate(
    config.mailBodyTemplate,
    values
  );

  if (!subject.ok || !body.ok) {
    return {
      status: 'failed',
      errorCode: 'MAIL_TEMPLATE_INVALID',
      reused: false
    };
  }

  try {
    MailApp.sendEmail({
      to: data.email,
      subject: subject.value,
      body: body.value
    });
    properties.setProperty(propertyKey, new Date().toISOString());
    return { status: 'success', errorCode: null, reused: false };
  } catch (error) {
    console.error('[GAOSYS_MAIL] MAIL_FAILED');
    return { status: 'failed', errorCode: 'MAIL_FAILED', reused: false };
  }
}

/**
 * メール送信済み管理用のScript Propertyキーを生成する。
 * @param {string} submissionId
 * @returns {string}
 */
function buildMailSentPropertyKey_(submissionId) {
  const normalized = String(submissionId || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_');
  return normalized ? `MAIL_SENT_${normalized}` : '';
}

/**
 * 申込単位の処理状態初期値を返す。
 * @returns {Object<string, string>}
 */
function createInitialOperationStatuses_() {
  return {
    calendar: 'skipped',
    submission: 'skipped',
    evaluationSheet: 'skipped',
    index: 'skipped',
    chat: 'skipped',
    mail: 'skipped'
  };
}

/**
 * Q列へ保存する処理状態JSONを生成する。
 * @param {Object<string, string>} operations
 * @returns {string}
 */
function serializeOperationStatuses_(operations) {
  return JSON.stringify({
    calendar: operations.calendar,
    submission: operations.submission,
    evaluationSheet: operations.evaluationSheet,
    index: operations.index,
    chat: operations.chat,
    mail: operations.mail
  });
}

/**
 * 申込リストQ列へ処理状態を保存する。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} row
 * @param {Object<string, string>} operations
 */
function updateSubmissionOperationStatuses_(sheet, row, operations) {
  sheet.getRange(row, 17).setValue(serializeOperationStatuses_(operations));
}

/**
 * 追加処理を独立した失敗境界で実行する。
 * @param {string} functionName
 * @param {string} submissionId
 * @param {string} operation
 * @param {Object<string, string>} operations
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} row
 * @param {Function} callback
 * @returns {Object}
 */
function runPostSubmissionOperation_(
  functionName,
  submissionId,
  operation,
  operations,
  sheet,
  row,
  callback
) {
  let result;
  try {
    result = callback() || { status: 'failed' };
  } catch (error) {
    result = { status: 'failed', errorCode: getOperationErrorCode_(operation) };
  }

  operations[operation] = normalizeOperationStatus_(result.status);
  updateSubmissionOperationStatuses_(sheet, row, operations);
  logOnboardingOperation_(functionName, submissionId, operation, result);
  return result;
}

/**
 * 許可された処理状態へ正規化する。
 * @param {string} status
 * @returns {string}
 */
function normalizeOperationStatus_(status) {
  return ['success', 'failed', 'skipped'].indexOf(status) === -1
    ? 'failed'
    : status;
}

/**
 * 追加処理の既定エラーコードを返す。
 * @param {string} operation
 * @returns {string}
 */
function getOperationErrorCode_(operation) {
  const errorCodes = {
    evaluationSheet: 'EVALUATION_COPY_FAILED',
    index: 'INDEX_WRITE_FAILED',
    chat: 'CHAT_FAILED',
    mail: 'MAIL_FAILED'
  };
  return errorCodes[operation] || 'UNEXPECTED_ERROR';
}

/**
 * 秘密値・個人情報を含めずに処理結果を記録する。
 * @param {string} functionName
 * @param {string} submissionId
 * @param {string} operation
 * @param {Object} result
 */
function logOnboardingOperation_(functionName, submissionId, operation, result) {
  const status = normalizeOperationStatus_(result && result.status);
  const entry = {
    message: `オンボーディング処理 ${operation}: ${status}`,
    functionName,
    status: status === 'failed' ? 'ERROR' : 'INFO',
    submissionId,
    operation,
    errorCode: result && result.errorCode ? result.errorCode : null,
    reused: Boolean(result && result.reused)
  };

  if (status === 'failed') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * 設定検証結果を秘密値なしで構造化ログへ記録する。
 * @param {string} functionName
 * @param {Object} result
 */
function logConfigurationResult_(functionName, result) {
  const entry = {
    message: result.ok
      ? 'アプリケーション設定の検証に成功しました。'
      : 'アプリケーション設定の検証に失敗しました。',
    functionName,
    status: result.ok ? 'SUCCESS' : 'ERROR',
    operation: 'configuration',
    errorCode: result.errorCode || null,
    missing: Array.isArray(result.missing) ? result.missing : [],
    invalid: Array.isArray(result.invalid) ? result.invalid : []
  };

  if (result.ok) {
    console.log(JSON.stringify(entry));
  } else {
    console.error(JSON.stringify(entry));
  }
}


/**
 * フォームデータをスプレッドシートに保存し、Googleカレンダーに予定を登録・更新します。
 * @param {object} formData - フロントエンドのフォーム入力データオブジェクト。
 * @param {string} formData.startTime - 申込み日 ('YYYY-MM-DD'形式)。
 * @param {boolean} formData.challenge - チャレンジ講師希望の有無。
 * @param {string} formData.name - 申込者名。
 * @param {string} formData.tadasukeName - タダスクネーム。
 * @param {string} formData.freeText - 自由記載。
 * @returns {{success: boolean, message: string}} 処理結果を示すオブジェクト。
 */
function saveFormData(formData) {
  const functionName = 'saveFormData';
  const submissionId = String(
    (formData && formData.submissionId) || Utilities.getUuid()
  );
  const operations = createInitialOperationStatuses_();

  console.log(JSON.stringify({
    message: 'フォームデータ保存処理を開始',
    functionName,
    status: 'START',
    submissionId
  }));

  try {
    const email = Session.getActiveUser().getEmail();
    const validationResult = GaosysDomain.validateFormInput(
      formData,
      getMasterData(),
      email
    );
    if (!validationResult.ok) {
      logOnboardingOperation_(
        functionName,
        submissionId,
        'validation',
        { status: 'failed', errorCode: 'VALIDATION_ERROR' }
      );
      return {
        success: false,
        message: '入力内容に不備があります。',
        submissionId,
        errorCode: 'VALIDATION_ERROR',
        operations
      };
    }
    const form = validationResult.value;

    const configurationResult = loadApplicationConfiguration_();
    if (!configurationResult.ok) {
      logOnboardingOperation_(
        functionName,
        submissionId,
        'configuration',
        {
          status: 'failed',
          errorCode: configurationResult.errorCode || 'CONFIG_INVALID'
        }
      );
      return {
        success: false,
        message: '設定不備により、申し込みを保存できませんでした。',
        submissionId,
        errorCode: configurationResult.errorCode || 'CONFIG_INVALID',
        operations
      };
    }
    const configuration = configurationResult.value;

    const ss = SpreadsheetApp.openById(getApplicationSpreadsheetId_());
    let submissionSheet = ss.getSheetByName(SUBMISSION_SHEET_NAME);
    if (!submissionSheet) {
      console.log(JSON.stringify({
        message: `シート「${SUBMISSION_SHEET_NAME}」が存在しないため、新規作成します。`,
        functionName,
        status: 'INFO',
        submissionId
      }));
      submissionSheet = initializeSubmissionSheet(ss);
    }

    const fullEventDateTime = new Date(
      `${form.startTime}T${configuration.startTime}:00`
    );
    if (isNaN(fullEventDateTime.getTime())) {
      operations.calendar = 'failed';
      return {
        success: false,
        message: '日時の形式が無効です。',
        submissionId,
        errorCode: 'VALIDATION_ERROR',
        operations
      };
    }

    let calendarId = null;

    const lastRow = submissionSheet.getLastRow();
    if (lastRow > 1) {
      const searchRange = submissionSheet.getRange(2, 8, lastRow - 1, 2);
      const values = searchRange.getValues();
      for (const row of values) {
        const existingId = row[0];
        const existingDate = row[1];
        if (existingId && existingDate instanceof Date &&
            existingDate.getTime() === fullEventDateTime.getTime()) {
          calendarId = existingId;
          console.log(JSON.stringify({
            message: 'H列、I列を基準に既存の予定を発見しました。',
            functionName,
            status: 'INFO',
            submissionId,
            operation: 'calendar'
          }));
          break;
        }
      }
    }

    let isNewEvent = (calendarId === null);
    let eventId = CalendarHandler.handleCalendarEvent({
      calendarId,
      calendarTagId: configuration.calendarId,
      dateTime: fullEventDateTime.toISOString(),
      title: configuration.calendarTitle,
      email,
      durationMinutes: configuration.durationMinutes
    });

    if (!eventId && calendarId) {
      console.log(JSON.stringify({
        message: '既存予定の更新に失敗したため、新規予定作成にフォールバックします。',
        functionName,
        status: 'INFO',
        submissionId,
        operation: 'calendar'
      }));
      eventId = CalendarHandler.handleCalendarEvent({
        calendarId: null,
        calendarTagId: configuration.calendarId,
        dateTime: fullEventDateTime.toISOString(),
        title: configuration.calendarTitle,
        email,
        durationMinutes: configuration.durationMinutes
      });
      if (eventId) {
        isNewEvent = true;
      }
    }

    if (!eventId) {
      operations.calendar = 'failed';
      logOnboardingOperation_(
        functionName,
        submissionId,
        'calendar',
        { status: 'failed', errorCode: 'CALENDAR_FAILED' }
      );
      return {
        success: false,
        message: 'カレンダーの予定作成または更新に失敗しました。',
        submissionId,
        errorCode: 'CALENDAR_FAILED',
        operations
      };
    }
    operations.calendar = 'success';
    logOnboardingOperation_(
      functionName,
      submissionId,
      'calendar',
      { status: 'success' }
    );

    if (isNewEvent) {
      CalendarHandler.addMeetLinkToEvent(configuration.calendarId, eventId);
    }

    const challengeStatus = form.challenge
      ? 'チャレンジ講師を希望する'
      : 'チャレンジ講師を希望しない';
    const displayDateString = Utilities.formatDate(
      fullEventDateTime,
      Session.getScriptTimeZone(),
      'yyyy年MM月dd日（E）'
    );
    const newRow = [
      new Date(),
      email,
      form.name,
      form.tadasukeName,
      displayDateString,
      challengeStatus,
      form.freeText,
      eventId,
      fullEventDateTime,
      '',
      '',
      '',
      '',
      '',
      '',
      submissionId,
      serializeOperationStatuses_(operations)
    ];
    let submissionRow = findSubmissionRowById_(submissionSheet, submissionId);
    const isExistingSubmission = submissionRow !== null;
    if (!isExistingSubmission) {
      submissionSheet.appendRow(newRow);
      submissionRow = submissionSheet.getLastRow();
    }
    operations.submission = 'success';
    updateSubmissionOperationStatuses_(submissionSheet, submissionRow, operations);
    logOnboardingOperation_(
      functionName,
      submissionId,
      'submission',
      { status: 'success', reused: isExistingSubmission }
    );

    const submission = {
      submissionId,
      email,
      name: form.name,
      tadasukeName: form.tadasukeName,
      startDate: displayDateString,
      challenge: challengeStatus,
      freeText: form.freeText
    };

    const evaluationSheet = runPostSubmissionOperation_(
      functionName,
      submissionId,
      'evaluationSheet',
      operations,
      submissionSheet,
      submissionRow,
      () => provisionEvaluationSheet_(submission, configuration)
    );

    const hasEvaluationSheet = evaluationSheet.status === 'success' &&
      String(evaluationSheet.url || '').trim() !== '';

    if (hasEvaluationSheet) {
      runPostSubmissionOperation_(
        functionName,
        submissionId,
        'index',
        operations,
        submissionSheet,
        submissionRow,
        () => registerIndexRow_(submission, evaluationSheet)
      );
    } else {
      operations.index = 'skipped';
      updateSubmissionOperationStatuses_(submissionSheet, submissionRow, operations);
      logOnboardingOperation_(
        functionName,
        submissionId,
        'index',
        { status: 'skipped' }
      );
    }

    runPostSubmissionOperation_(
      functionName,
      submissionId,
      'chat',
      operations,
      submissionSheet,
      submissionRow,
      () => notifyOnboardingChat_(submission, evaluationSheet, configuration)
    );

    if (hasEvaluationSheet) {
      runPostSubmissionOperation_(
        functionName,
        submissionId,
        'mail',
        operations,
        submissionSheet,
        submissionRow,
        () => sendAcknowledgementMail_(submission, evaluationSheet, configuration)
      );
    } else {
      operations.mail = 'skipped';
      updateSubmissionOperationStatuses_(submissionSheet, submissionRow, operations);
      logOnboardingOperation_(
        functionName,
        submissionId,
        'mail',
        { status: 'skipped' }
      );
    }

    return {
      success: true,
      message: '申し込みを受け付けました。ありがとうございます。',
      submissionId,
      operations
    };

  } catch (error) {
    if (operations.submission === 'skipped' &&
        operations.calendar === 'success') {
      operations.submission = 'failed';
    }
    console.error(JSON.stringify({
      message: 'フォームデータの保存中に致命的なエラーが発生しました。',
      functionName,
      status: 'ERROR',
      submissionId,
      operation: 'saveFormData',
      errorCode: operations.submission === 'failed'
        ? 'SUBMISSION_WRITE_FAILED'
        : 'UNEXPECTED_ERROR',
      error: { name: error.name }
    }));
    return {
      success: false,
      message: 'サーバーエラーにより、申し込みを保存できませんでした。',
      submissionId,
      errorCode: operations.submission === 'failed'
        ? 'SUBMISSION_WRITE_FAILED'
        : 'UNEXPECTED_ERROR',
      operations
    };
  }
}

// =================================================================
// ヘルパー関数
// =================================================================
/**
 * 申込データ保存用のシートが存在しない場合に、ヘッダー付きで新規作成します。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - 対象のスプレッドシートオブジェクト。
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} 作成されたシートオブジェクト。
 */
function initializeSubmissionSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet(SUBMISSION_SHEET_NAME);
  
  // ご指定の15列の構成でヘッダーを作成
  const headers = [
    'タイムスタンプ',
    '申込者メールアドレス',
    'お名前',
    'タダスクネーム',
    '希望開始時期',
    'チャレンジ講師',
    '自由記載',
    'カレンダーID',
    '開催日時Data',
    'タイムスタンプ（RES)',
    '担当サポーター担当',
    'サポーターメールアドレス',
    'サブサポーター',
    'サブサポーターメールアドレス',
    '新講師へのメッセージ',
    '申込ID',
    'オンボーディング状態'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function findSubmissionRowById_(sheet, submissionId) {
  const normalizedSubmissionId = String(submissionId || '').trim();
  if (!normalizedSubmissionId) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const values = sheet.getRange(2, 16, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0] || '').trim() === normalizedSubmissionId) {
      return index + 2;
    }
  }
  return null;
}

/**
 * 文字列内のカタカナをひらがなに変換します。
 * @param {string} str - 変換対象の文字列。
 * @returns {string} ひらがなに変換後の文字列。
 */
function katakanaToHiragana(str) {
  if (typeof str !== 'string' || !str) return '';
  return str.replace(/[\u30A1-\u30F6]/g, match => 
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}
