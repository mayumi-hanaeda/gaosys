/**
 * @fileoverview
 * スプレッドシート「申込リスト」への新規行追加を検知し、Google Chatへ通知を送信します。
 * @version 2.1.0
 */

// =========================================================================
// スクリプト全体の設定
// =========================================================================

const SCRIPT_CONFIG = {
  /** @type {string} 監視対象のシート名 */
  SHEET_NAME: "申込リスト",
  
  /** @type {string} 追加したい一行メッセージ */
  ADDITIONAL_MESSAGE_PREFIX: "サポート状況＆新講師申込フォーム：",

  /** @type {Array<{index: number, label: string}>} 通知に含める列の情報 */
  COLUMNS_TO_INCLUDE: [
    { index: 1, label: "申込者メールアドレス" }, // B列
    { index: 2, label: "お名前" },               // C列
    { index: 3, label: "タダスクネーム" },       // D列
    { index: 4, label: "オリエンテーション参加日" }, // E列
    { index: 5, label: "チャレンジ講師" },       // F列
    { index: 6, label: "自由記載" }             // G列
  ],
  
  /** @type {string} 最後に処理した行番号を保存するためのキー */
  PROPERTY_KEY_LAST_ROW: 'LAST_PROCESSED_ROW'
};

const CHAT_WEBHOOK_CONFIG_CONFIRM_TOKEN = 'CONFIGURE:SEC-001-CHAT';
const CHAT_SENT_PROPERTY_PREFIX = 'CHAT_SENT_';

// =========================================================================
// 初期設定用関数
// =========================================================================

function initialSetup() {
  console.log("初期設定処理を開始します...");
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCRIPT_CONFIG.SHEET_NAME);
    if (!sheet) {
      console.error(`シート「${SCRIPT_CONFIG.SHEET_NAME}」が見つかりませんでした。`);
      return;
    }
    const lastRow = sheet.getLastRow();
    PropertiesService.getScriptProperties().setProperty(SCRIPT_CONFIG.PROPERTY_KEY_LAST_ROW, lastRow.toString());
    console.log(`初期設定完了。最終行 (${lastRow}行目) までを処理済みとして記録しました。`);
  } catch (error) {
    console.error(`初期設定エラー: ${error.toString()}`);
  }
}

// =========================================================================
// メイン処理（トリガー設定用）
// =========================================================================

function handleSheetChange(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCRIPT_CONFIG.SHEET_NAME);
    if (!sheet) return;

    const properties = PropertiesService.getScriptProperties();
    const lastProcessedRow = parseInt(properties.getProperty(SCRIPT_CONFIG.PROPERTY_KEY_LAST_ROW) || '0', 10);
    const currentLastRow = sheet.getLastRow();
    
    if (currentLastRow > lastProcessedRow) {
      for (let i = lastProcessedRow + 1; i <= currentLastRow; i++) {
        const newRowData = sheet.getRange(i, 1, 1, sheet.getLastColumn()).getValues()[0];
        const message = createNotificationMessage_(newRowData, SCRIPT_CONFIG.COLUMNS_TO_INCLUDE);

        if (message) {
          const result = sendNotificationToChat_(message);
          if (!result.ok) {
            console.error(
              `[GAOSYS_CHAT_NOTIFICATION] ${JSON.stringify(result)}`
            );
          }
        }
      }
      properties.setProperty(SCRIPT_CONFIG.PROPERTY_KEY_LAST_ROW, currentLastRow.toString());
    }
  } catch (error) {
    console.error(`メイン処理エラー: ${error.toString()}`);
  }
}

// =========================================================================
// テスト用関数
// =========================================================================

function testSendNotification() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCRIPT_CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) return;
    
    const testData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    let message = createNotificationMessage_(testData, SCRIPT_CONFIG.COLUMNS_TO_INCLUDE);
    
    if (message) {
      return sendNotificationToChat_("【テスト送信】\n" + message);
    }
  } catch (error) {
    console.error(`テスト送信エラー: ${error.toString()}`);
    return { ok: false, errorCode: 'CHAT_TEST_FAILED' };
  }
}

/**
 * 本番Chat Webhookを確認トークン付きでScript Propertiesへ保存します。
 * @param {{confirmToken: string, webhookUrl: string}} options
 * @returns {{ok: boolean, propertyKey?: string, errorCode?: string}}
 */
function configureProductionChatWebhook(options) {
  const input = options || {};
  if (input.confirmToken !== CHAT_WEBHOOK_CONFIG_CONFIRM_TOKEN) {
    return {
      ok: false,
      errorCode: 'CHAT_CONFIG_CONFIRMATION_REQUIRED'
    };
  }

  const webhookUrl = typeof input.webhookUrl === 'string'
    ? input.webhookUrl.trim()
    : '';
  if (!/^https:\/\/chat\.googleapis\.com\/v1\/spaces\/[^/]+\/messages/.test(
    webhookUrl
  )) {
    return { ok: false, errorCode: 'INVALID_CHAT_WEBHOOK_URL' };
  }

  PropertiesService.getScriptProperties().setProperty(
    'CHAT_WEBHOOK_URL',
    webhookUrl
  );
  return { ok: true, propertyKey: 'CHAT_WEBHOOK_URL' };
}

/**
 * SEC-001確認用の個人情報を含まないChat通知を送信します。
 * @returns {{ok: boolean, errorCode?: string, responseCode?: number}}
 */
function runProductionChatWebhookSmokeTest() {
  return sendNotificationToChat_(
    '[TEST][SEC-001] Chat Webhook rotation smoke passed'
  );
}

/**
 * オンボーディング受付内容をGoogle Chatへ通知します。
 * 同じsubmissionIdで成功済みの場合は再送しません。
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
 * @param {{spreadsheetUrl?: string}} configuration
 * @returns {{status: string, errorCode: string|null, responseCode?: number, reused: boolean}}
 */
function notifyOnboardingChat_(submission, evaluationSheet, configuration) {
  const data = submission || {};
  const properties = PropertiesService.getScriptProperties();
  const propertyKey = buildChatSentPropertyKey_(data.submissionId);

  if (!propertyKey) {
    return {
      status: 'failed',
      errorCode: 'CHAT_FAILED',
      reused: false
    };
  }

  if (properties.getProperty(propertyKey)) {
    return {
      status: 'success',
      errorCode: null,
      reused: true
    };
  }

  const config = configuration || {};
  const message = GaosysDomain.buildChatMessage({
    submissionId: data.submissionId,
    email: data.email,
    name: data.name,
    tadasukeName: data.tadasukeName,
    startDate: data.startDate,
    challenge: data.challenge,
    freeText: data.freeText,
    evaluationSheetUrl: evaluationSheet && evaluationSheet.url,
    spreadsheetUrl: config.spreadsheetUrl || getDefaultSpreadsheetUrl_()
  });
  const result = sendNotificationToChat_(message);

  if (!result.ok) {
    return {
      status: 'failed',
      errorCode: 'CHAT_FAILED',
      responseCode: result.responseCode,
      reused: false
    };
  }

  properties.setProperty(propertyKey, new Date().toISOString());
  return {
    status: 'success',
    errorCode: null,
    responseCode: result.responseCode,
    reused: false
  };
}

// =========================================================================
// ヘルパー関数（内部処理用）
// =========================================================================

/**
 * 行データからメッセージを生成します。
 */
function createNotificationMessage_(rowData, columnsToInclude) {
  let messageParts = [];
  
  columnsToInclude.forEach(colInfo => {
    const cellData = rowData[colInfo.index];
    if (cellData != null && cellData.toString().trim() !== "") {
      messageParts.push(`*${colInfo.label}*: ${cellData}`);
    }
  });

  if (messageParts.length > 0) {
    // ここでメッセージを組み立てています
    const additionalMessage = getAdditionalNotificationMessage_();
    return "新しい申し込みがありました。\n\n" 
           + messageParts.join("\n")
           + (additionalMessage ? `\n\n${additionalMessage}` : '');
  }
  
  return null;
}

/**
 * Script PropertiesからGoogle Chat Webhook URLを取得します。
 * @returns {string}
 */
function getChatWebhookUrl_() {
  return (
    PropertiesService.getScriptProperties()
      .getProperty('CHAT_WEBHOOK_URL') || ''
  ).trim();
}

/**
 * 追加通知メッセージをScript Propertiesから組み立てる。
 * @returns {string}
 */
function getAdditionalNotificationMessage_() {
  const spreadsheetUrl = getDefaultSpreadsheetUrl_();
  return spreadsheetUrl
    ? `${SCRIPT_CONFIG.ADDITIONAL_MESSAGE_PREFIX}${spreadsheetUrl}`
    : '';
}

/**
 * Chat送信済み管理用のScript Propertyキーを生成します。
 * @param {string} submissionId
 * @returns {string}
 */
function buildChatSentPropertyKey_(submissionId) {
  const normalized = String(submissionId || '')
    .trim()
    .replace(/[^A-Za-z0-9_]/g, '_');
  return normalized ? `${CHAT_SENT_PROPERTY_PREFIX}${normalized}` : '';
}

/**
 * 現行運用スプレッドシートのURLを返します。
 * @returns {string}
 */
function getDefaultSpreadsheetUrl_() {
  return (
    PropertiesService.getScriptProperties()
      .getProperty('SUPPORT_STATUS_SPREADSHEET_URL') || ''
  ).trim();
}

/**
 * Google Chatへ送信します。
 * @param {string} message
 * @returns {{ok: boolean, errorCode?: string, responseCode?: number}}
 */
function sendNotificationToChat_(message) {
  const webhookUrl = getChatWebhookUrl_();
  if (!webhookUrl) {
    return { ok: false, errorCode: 'CHAT_WEBHOOK_NOT_CONFIGURED' };
  }

  const payload = { 'text': message };
  const options = {
    'method': 'post',
    'contentType': 'application/json; charset=UTF-8',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();
    if (responseCode < 200 || responseCode >= 300) {
      return {
        ok: false,
        errorCode: 'CHAT_HTTP_ERROR',
        responseCode
      };
    }
    return { ok: true, responseCode };
  } catch(error) {
    console.error('[GAOSYS_CHAT_NOTIFICATION] CHAT_FETCH_FAILED');
    return { ok: false, errorCode: 'CHAT_FETCH_FAILED' };
  }
}
