/**
 * Google Apps Script APIに依存しないドメインロジック。
 * GASとNode.jsテストの両方から同じ実装を利用する。
 */
var GaosysDomain = (function() {
  'use strict';

  const DEFAULT_START_TIME = '20:00';
  const EVALUATION_SHEET_SUFFIX = '評価項目チェックシート';
  const MAIL_TAG_PATTERN = /{{([A-Za-z][A-Za-z0-9]*)}}/g;
  const ALLOWED_MAIL_TAGS = [
    'name',
    'tadasukeName',
    'startDate',
    'challenge',
    'freeText',
    'evaluationSheetUrl',
    'responseSummary'
  ];

  function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function unique(values) {
    return values.filter((value, index) => values.indexOf(value) === index);
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function normalizeStartTime(value) {
    if (value === '' || value === null || typeof value === 'undefined') {
      return DEFAULT_START_TIME;
    }

    if (value && typeof value.getHours === 'function') {
      return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
    }

    const normalized = trimString(value);
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)
      ? normalized
      : null;
  }

  /**
   * 設定シートとScript Propertiesの値を検証・正規化する。
   * @param {Object} sheetValues
   * @param {Object} properties
   * @returns {Object}
   */
  function normalizeConfiguration(sheetValues, properties) {
    const sheet = sheetValues || {};
    const props = properties || {};
    const missing = [];
    const invalid = [];
    const requiredStrings = [
      ['calendarTitle', sheet.calendarTitle],
      ['calendarId', sheet.calendarId],
      ['evaluationTemplateId', sheet.evaluationTemplateId],
      ['mailSubjectTemplate', sheet.mailSubjectTemplate],
      ['mailBodyTemplate', sheet.mailBodyTemplate],
      ['CHAT_WEBHOOK_URL', props.chatWebhookUrl],
      ['EVALUATION_SHEET_FOLDER_ID', props.evaluationFolderId]
    ];

    requiredStrings.forEach(([name, value]) => {
      if (trimString(value) === '') missing.push(name);
    });

    if (sheet.durationMinutes === '' ||
        sheet.durationMinutes === null ||
        typeof sheet.durationMinutes === 'undefined') {
      missing.push('durationMinutes');
    } else if (!Number.isInteger(sheet.durationMinutes) ||
               sheet.durationMinutes <= 0) {
      invalid.push('durationMinutes');
    }

    const startTime = normalizeStartTime(sheet.startTime);
    if (startTime === null) invalid.push('startTime');

    if (missing.length > 0 || invalid.length > 0) {
      return {
        ok: false,
        errorCode: 'CONFIG_INVALID',
        missing: unique(missing),
        invalid: unique(invalid)
      };
    }

    return {
      ok: true,
      value: {
        calendarTitle: trimString(sheet.calendarTitle),
        calendarId: trimString(sheet.calendarId),
        durationMinutes: sheet.durationMinutes,
        startTime,
        evaluationTemplateId: trimString(sheet.evaluationTemplateId),
        mailSubjectTemplate: trimString(sheet.mailSubjectTemplate),
        mailBodyTemplate: trimString(sheet.mailBodyTemplate),
        chatWebhookUrl: trimString(props.chatWebhookUrl),
        evaluationFolderId: trimString(props.evaluationFolderId)
      }
    };
  }

  function isValidIsoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /**
   * フォーム値をサーバー側ルールで検証する。
   * @param {Object} formData
   * @param {Array<string|Object>} masterNames
   * @param {string} email
   * @returns {Object}
   */
  function validateFormInput(formData, masterNames, email) {
    const form = formData || {};
    const normalized = {
      name: trimString(form.name),
      tadasukeName: trimString(form.tadasukeName),
      startTime: trimString(form.startTime),
      challenge: form.challenge,
      freeText: typeof form.freeText === 'string' ? form.freeText : '',
      email: trimString(email)
    };
    const invalid = [];
    const allowedNames = (masterNames || []).map(item =>
      typeof item === 'string' ? item : trimString(item && item.fullName)
    );

    if (normalized.name === '' ||
        allowedNames.indexOf(normalized.name) === -1) {
      invalid.push('name');
    }
    if (normalized.tadasukeName === '' ||
        normalized.tadasukeName.length > 100) {
      invalid.push('tadasukeName');
    }
    if (!isValidIsoDate(normalized.startTime)) {
      invalid.push('startTime');
    }
    if (typeof normalized.challenge !== 'boolean') {
      invalid.push('challenge');
    }
    if (typeof form.freeText !== 'string' ||
        normalized.freeText.length > 5000) {
      invalid.push('freeText');
    }
    if (!isValidEmail(normalized.email)) {
      invalid.push('email');
    }

    if (invalid.length > 0) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        invalid: unique(invalid)
      };
    }

    return { ok: true, value: normalized };
  }

  function sanitizeFileNamePart(value) {
    return String(value || '')
      .replace(/[\u0000-\u001F\u007F]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 評価シートのファイル名を生成する。
   * @param {string} tadasukeName
   * @param {string} fallbackName
   * @returns {string}
   */
  function buildEvaluationSheetName(tadasukeName, fallbackName) {
    const primary = sanitizeFileNamePart(tadasukeName);
    const fallback = sanitizeFileNamePart(fallbackName);
    const displayName = primary || fallback;

    return `★【${displayName}】${EVALUATION_SHEET_SUFFIX}`;
  }

  /**
   * indexのB〜F列へ書き込む中間データを生成する。
   * @param {Object} input
   * @returns {Object}
   */
  function buildIndexRowData(input) {
    const data = input || {};
    const fileName = trimString(data.fileName);

    return {
      startColumn: 2,
      values: [
        trimString(data.tadasukeName),
        '',
        '',
        '',
        fileName
      ],
      link: {
        valueIndex: 4,
        text: fileName,
        url: trimString(data.url)
      }
    };
  }

  function appendChatField(parts, label, value) {
    if (value === '' || value === null || typeof value === 'undefined') return;
    parts.push(`*${label}*: ${value}`);
  }

  /**
   * Google Chat通知本文を生成する。
   * @param {Object} input
   * @returns {string}
   */
  function buildChatMessage(input) {
    const data = input || {};
    const parts = ['新しい申し込みがありました。', ''];

    appendChatField(parts, '申込ID', data.submissionId);
    appendChatField(parts, '申込者メールアドレス', data.email);
    appendChatField(parts, 'お名前', data.name);
    appendChatField(parts, 'タダスクネーム', data.tadasukeName);
    appendChatField(parts, 'オリエンテーション参加日', data.startDate);
    appendChatField(parts, 'チャレンジ講師', data.challenge);
    appendChatField(parts, '自由記載', data.freeText);

    const evaluationValue = trimString(data.evaluationSheetUrl) ||
      '発行失敗・要手動対応';
    appendChatField(parts, '評価項目チェックシート', evaluationValue);

    if (trimString(data.spreadsheetUrl) !== '') {
      parts.push('');
      parts.push(
        `サポート状況＆新講師申込フォーム：${trimString(data.spreadsheetUrl)}`
      );
    }

    return parts.join('\n');
  }

  /**
   * メールへ埋め込むフォーム回答控えを生成する。
   * @param {Object} input
   * @returns {string}
   */
  function buildResponseSummary(input) {
    const data = input || {};
    const freeText = trimString(data.freeText) || 'なし';

    return [
      `お名前: ${trimString(data.name)}`,
      `タダスクネーム: ${trimString(data.tadasukeName)}`,
      `参加希望日: ${trimString(data.startDate)}`,
      `チャレンジ講師: ${trimString(data.challenge)}`,
      `自由記載: ${freeText}`
    ].join('\n');
  }

  /**
   * メールテンプレートのタグを置換する。
   * @param {string} template
   * @param {Object} inputValues
   * @returns {Object}
   */
  function renderMailTemplate(template, inputValues) {
    const source = typeof template === 'string' ? template : '';
    const values = Object.assign({}, inputValues || {});
    const tags = [];
    let match;

    values.freeText = trimString(values.freeText) || 'なし';
    if (trimString(values.responseSummary) === '') {
      values.responseSummary = buildResponseSummary(values);
    }

    MAIL_TAG_PATTERN.lastIndex = 0;
    while ((match = MAIL_TAG_PATTERN.exec(source)) !== null) {
      tags.push(match[1]);
    }

    const invalidTags = tags.filter(tag =>
      ALLOWED_MAIL_TAGS.indexOf(tag) === -1 ||
      trimString(values[tag]) === ''
    );

    if (source === '' || invalidTags.length > 0) {
      return {
        ok: false,
        errorCode: 'MAIL_TEMPLATE_INVALID',
        invalidTags: unique(invalidTags)
      };
    }

    MAIL_TAG_PATTERN.lastIndex = 0;
    const value = source.replace(MAIL_TAG_PATTERN, (_, tag) =>
      String(values[tag])
    );

    if (/{{[^{}]+}}/.test(value)) {
      return {
        ok: false,
        errorCode: 'MAIL_TEMPLATE_INVALID',
        invalidTags: []
      };
    }

    return { ok: true, value };
  }

  function isSuccessfulHttpStatus(statusCode) {
    return Number.isInteger(statusCode) &&
      statusCode >= 200 &&
      statusCode <= 299;
  }

  /**
   * 指定日時より未来にある第3月曜日を生成する。
   * @param {Date|string|number} now
   * @param {number} count
   * @returns {Array<Object>}
   */
  function generateFutureThirdMondays(now, count) {
    const limit = Number.isInteger(count) && count > 0 ? count : 3;
    const currentMoment = new Date(
      now && typeof now.getTime === 'function' ? now.getTime() : now
    );
    const cursor = new Date(
      currentMoment.getFullYear(),
      currentMoment.getMonth(),
      1
    );
    const dates = [];

    while (dates.length < limit) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const firstDay = new Date(year, month, 1);
      const firstMondayOffset = (8 - firstDay.getDay()) % 7;
      const thirdMonday = new Date(year, month, 15 + firstMondayOffset);

      if (thirdMonday > currentMoment) {
        dates.push({
          display: `${year}年${month + 1}月${thirdMonday.getDate()}日(月)`,
          value: `${year}-${pad2(month + 1)}-${pad2(thirdMonday.getDate())}`
        });
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return dates;
  }

  return {
    normalizeConfiguration,
    validateFormInput,
    buildEvaluationSheetName,
    buildIndexRowData,
    buildChatMessage,
    buildResponseSummary,
    renderMailTemplate,
    isSuccessfulHttpStatus,
    generateFutureThirdMondays
  };
})();

