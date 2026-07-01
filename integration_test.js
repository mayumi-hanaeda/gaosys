/**
 * 非本番統合テストの設定検証、実行ガード、作成物追跡を提供する。
 */
var GaosysIntegrationTest = (function() {
  'use strict';

  const REQUIRED_CONFIGURATION_KEYS = [
    'TEST_SPREADSHEET_ID',
    'TEST_CALENDAR_ID',
    'TEST_EVALUATION_FOLDER_ID',
    'TEST_CHAT_WEBHOOK_URL',
    'TEST_MAIL_RECIPIENT'
  ];
  const PLANNED_TARGETS = [
    'spreadsheet',
    'calendar',
    'drive',
    'chat',
    'mail'
  ];
  const PRODUCTION_RESOURCE_ID_PROPERTY_KEYS = {
    TEST_SPREADSHEET_ID: 'GAOSYS_SPREADSHEET_ID'
  };
  const TEST_RUN_ID_PATTERN =
    /^\d{8}T\d{6}Z-[a-z0-9][a-z0-9-]{5,39}$/;
  const PROVISION_CONFIRM_TOKEN = 'PROVISION:TDD-005';
  const CHAT_CONFIG_CONFIRM_TOKEN = 'CONFIGURE:TDD-005-CHAT';

  function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function buildPrefix(testRunId) {
    return `[TEST][${testRunId}]`;
  }

  function validateConfiguration(configuration) {
    const values = configuration || {};
    const missing = REQUIRED_CONFIGURATION_KEYS.filter(key =>
      trimString(values[key]) === ''
    );
    const rejected = Object.keys(PRODUCTION_RESOURCE_ID_PROPERTY_KEYS)
      .filter(key => {
        const propertyKey = PRODUCTION_RESOURCE_ID_PROPERTY_KEYS[key];
        const productionResourceId = trimString(
          PropertiesService.getScriptProperties().getProperty(propertyKey)
        );
        return productionResourceId !== '' &&
          trimString(values[key]) === productionResourceId;
      });

    if (missing.length > 0) {
      return {
        ok: false,
        errorCode: 'INTEGRATION_CONFIG_INVALID',
        missing
      };
    }
    if (rejected.length > 0) {
      return {
        ok: false,
        errorCode: 'PRODUCTION_RESOURCE_REJECTED',
        rejected
      };
    }
    return { ok: true };
  }

  /**
   * 実行前に設定と確認トークンを検証し、安全な操作計画だけを返す。
   * @param {Object=} options
   * @param {Object=} configuration
   * @returns {Object}
   */
  function prepareRun(options, configuration) {
    const input = options && typeof options === 'object' ? options : {};
    const mode = input.mode === 'execute' ? 'execute' : 'preview';
    const testRunId = trimString(input.testRunId);
    const expectedConfirmToken = `RUN:${testRunId}`;
    const configResult = validateConfiguration(configuration);

    if (!configResult.ok) {
      return Object.assign({ externalWrites: 0 }, configResult);
    }
    if (!TEST_RUN_ID_PATTERN.test(testRunId)) {
      return {
        ok: false,
        errorCode: 'INVALID_TEST_RUN_ID',
        externalWrites: 0
      };
    }
    if (mode === 'execute' &&
        trimString(input.confirmToken) !== expectedConfirmToken) {
      return {
        ok: false,
        errorCode: 'CONFIRMATION_REQUIRED',
        requiredConfirmToken: expectedConfirmToken,
        externalWrites: 0
      };
    }

    return {
      ok: true,
      mode,
      testRunId,
      prefix: buildPrefix(testRunId),
      plannedTargets: PLANNED_TARGETS.slice(),
      externalWrites: 0
    };
  }

  /**
   * cleanup台帳へ保存する最小レコードを作る。
   * @param {string} testRunId
   * @param {string} target
   * @param {string} resourceId
   * @returns {Object}
   */
  function buildResourceRecord(testRunId, target, resourceId) {
    return {
      testRunId: trimString(testRunId),
      target: trimString(target),
      resourceId: trimString(resourceId),
      marker: buildPrefix(trimString(testRunId))
    };
  }

  /**
   * 指定実行が所有するテスト作成物だけをcleanup対象として許可する。
   * @param {string} testRunId
   * @param {Object=} resource
   * @returns {boolean}
   */
  function canCleanupResource(testRunId, resource) {
    const normalizedRunId = trimString(testRunId);
    const item = resource || {};

    return TEST_RUN_ID_PATTERN.test(normalizedRunId) &&
      trimString(item.testRunId) === normalizedRunId &&
      trimString(item.resourceId) !== '' &&
      trimString(item.marker) === buildPrefix(normalizedRunId) &&
      PLANNED_TARGETS.indexOf(trimString(item.target)) !== -1;
  }

  function prepareProvision(options) {
    const input = options && typeof options === 'object' ? options : {};

    if (trimString(input.confirmToken) !== PROVISION_CONFIRM_TOKEN) {
      return {
        ok: false,
        errorCode: 'PROVISION_CONFIRMATION_REQUIRED',
        externalWrites: 0
      };
    }

    return {
      ok: true,
      prefix: '[TEST] GAOSYS Integration',
      resources: [
        'spreadsheet',
        'calendar',
        'driveFolder',
        'mailRecipient'
      ],
      externalWrites: 0
    };
  }

  function prepareChatWebhook(options) {
    const input = options && typeof options === 'object' ? options : {};
    const webhookUrl = trimString(input.webhookUrl);

    if (trimString(input.confirmToken) !== CHAT_CONFIG_CONFIRM_TOKEN) {
      return {
        ok: false,
        errorCode: 'CHAT_CONFIG_CONFIRMATION_REQUIRED'
      };
    }
    if (!/^https:\/\/chat\.googleapis\.com\/v1\/spaces\/[^/]+\/messages\?/.test(
      webhookUrl
    ) || webhookUrl.indexOf('key=') === -1 ||
        webhookUrl.indexOf('token=') === -1) {
      return {
        ok: false,
        errorCode: 'INVALID_TEST_CHAT_WEBHOOK_URL'
      };
    }
    return { ok: true };
  }

  function executeWithAdapter(options, configuration, adapter) {
    const plan = prepareRun(options, configuration);
    if (!plan.ok || plan.mode !== 'execute') return plan;

    const tests = PLANNED_TARGETS.map(target => {
      try {
        const operation = adapter[target](plan.testRunId, plan.prefix);
        return {
          target,
          status: operation.status === 'passed' ? 'passed' : 'failed',
          cleaned: operation.cleaned === true
        };
      } catch (error) {
        return {
          target,
          status: 'failed',
          cleaned: false
        };
      }
    });

    const passed = tests.filter(test => test.status === 'passed').length;
    return {
      ok: passed === tests.length,
      mode: 'execute',
      testRunId: plan.testRunId,
      passed,
      failed: tests.length - passed,
      tests
    };
  }

  return {
    buildResourceRecord,
    canCleanupResource,
    executeWithAdapter,
    prepareChatWebhook,
    prepareProvision,
    prepareRun,
    validateConfiguration
  };
})();

function getIntegrationTestConfiguration_() {
  const properties = PropertiesService.getScriptProperties();
  const configuration = {};
  [
    'TEST_SPREADSHEET_ID',
    'TEST_CALENDAR_ID',
    'TEST_EVALUATION_FOLDER_ID',
    'TEST_CHAT_WEBHOOK_URL',
    'TEST_MAIL_RECIPIENT'
  ].forEach(key => {
    configuration[key] = properties.getProperty(key) || '';
  });
  return configuration;
}

/**
 * 非本番統合テストの設定と実行ガードを検証する公開関数。
 * 現段階では外部書き込みを行わず、実行計画だけを返す。
 * @param {Object=} options
 * @returns {Object}
 */
function runIntegrationTestSuite(options) {
  const configuration = getIntegrationTestConfiguration_();
  const preflight = GaosysIntegrationTest.prepareRun(options, configuration);
  const result = preflight.ok && preflight.mode === 'execute'
    ? GaosysIntegrationTest.executeWithAdapter(
      options,
      configuration,
      createIntegrationTestAdapter_(configuration)
    )
    : preflight;
  console.log('[GAOSYS_INTEGRATION_PREFLIGHT] ' + JSON.stringify({
    ok: result.ok,
    mode: result.mode || 'blocked',
    errorCode: result.errorCode || '',
    testRunId: result.testRunId || '',
    externalWrites: result.externalWrites,
    passed: result.passed || 0,
    failed: result.failed || 0,
    cleaned: Array.isArray(result.tests)
      ? result.tests.filter(test => test.cleaned).length
      : 0
  }));
  return result;
}

function createIntegrationTestAdapter_(configuration) {
  function testFileName(prefix, suffix) {
    return `${prefix} ${suffix}`;
  }

  return {
    spreadsheet(testRunId, prefix) {
      const spreadsheet = SpreadsheetApp.openById(
        configuration.TEST_SPREADSHEET_ID
      );
      const sheet = spreadsheet.insertSheet(
        testFileName(prefix, 'Spreadsheet')
      );
      sheet.getRange('A1:B2').setValues([
        ['TEST_RUN_ID', testRunId],
        ['marker', prefix]
      ]);
      const verified = sheet.getRange('A1:B2').getValues();
      spreadsheet.deleteSheet(sheet);
      return {
        status: verified[0][1] === testRunId ? 'passed' : 'failed',
        cleaned: true
      };
    },

    calendar(testRunId, prefix) {
      const calendar = CalendarApp.getCalendarById(
        configuration.TEST_CALENDAR_ID
      );
      if (!calendar) throw new Error('test calendar not found');
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const event = calendar.createEvent(
        testFileName(prefix, 'Calendar'),
        start,
        end,
        { description: `TEST_RUN_ID=${testRunId}` }
      );
      const verified = event.getTitle().indexOf(prefix) === 0;
      event.deleteEvent();
      return {
        status: verified ? 'passed' : 'failed',
        cleaned: true
      };
    },

    drive(testRunId, prefix) {
      const folder = DriveApp.getFolderById(
        configuration.TEST_EVALUATION_FOLDER_ID
      );
      const file = folder.createFile(
        testFileName(prefix, 'Drive.txt'),
        `TEST_RUN_ID=${testRunId}`,
        MimeType.PLAIN_TEXT
      );
      const verified = file.getName().indexOf(prefix) === 0;
      file.setTrashed(true);
      return {
        status: verified ? 'passed' : 'failed',
        cleaned: true
      };
    },

    chat(testRunId, prefix) {
      const response = UrlFetchApp.fetch(
        configuration.TEST_CHAT_WEBHOOK_URL,
        {
          method: 'post',
          contentType: 'application/json; charset=UTF-8',
          payload: JSON.stringify({
            text: `${prefix} integration smoke passed`
          }),
          muteHttpExceptions: true
        }
      );
      const statusCode = response.getResponseCode();
      return {
        status: statusCode >= 200 && statusCode <= 299
          ? 'passed'
          : 'failed',
        cleaned: false
      };
    },

    mail(testRunId, prefix) {
      MailApp.sendEmail({
        to: configuration.TEST_MAIL_RECIPIENT,
        subject: `${prefix} integration smoke`,
        body: `TEST_RUN_ID=${testRunId}\nThis is a non-production test.`
      });
      return { status: 'passed', cleaned: false };
    }
  };
}

/**
 * TDD-005専用の非本番リソースを作成し、Script Propertiesへ保存する。
 * @param {Object=} options
 * @returns {Object}
 */
function provisionIntegrationTestResources(options) {
  const guard = GaosysIntegrationTest.prepareProvision(options);
  if (!guard.ok) return guard;

  const properties = PropertiesService.getScriptProperties();
  const created = {
    spreadsheet: false,
    calendar: false,
    driveFolder: false,
    mailRecipient: false
  };

  if (!properties.getProperty('TEST_SPREADSHEET_ID')) {
    const spreadsheet = SpreadsheetApp.create(
      '[TEST] GAOSYS Integration Spreadsheet'
    );
    properties.setProperty('TEST_SPREADSHEET_ID', spreadsheet.getId());
    created.spreadsheet = true;
  }

  if (!properties.getProperty('TEST_CALENDAR_ID')) {
    const calendar = CalendarApp.createCalendar(
      '[TEST] GAOSYS Integration Calendar'
    );
    properties.setProperty('TEST_CALENDAR_ID', calendar.getId());
    created.calendar = true;
  }

  if (!properties.getProperty('TEST_EVALUATION_FOLDER_ID')) {
    const folder = DriveApp.createFolder(
      '[TEST] GAOSYS Integration Evaluations'
    );
    properties.setProperty(
      'TEST_EVALUATION_FOLDER_ID',
      folder.getId()
    );
    created.driveFolder = true;
  }

  if (!properties.getProperty('TEST_MAIL_RECIPIENT')) {
    const activeEmail = Session.getActiveUser().getEmail();
    if (!activeEmail) {
      throw new Error('TEST_MAIL_RECIPIENT could not be determined');
    }
    properties.setProperty('TEST_MAIL_RECIPIENT', activeEmail);
    created.mailRecipient = true;
  }

  const result = {
    ok: true,
    created,
    missing: getMissingIntegrationConfigurationKeys_(),
    externalWrites:
      Object.keys(created).filter(key => created[key]).length
  };
  console.log('[GAOSYS_INTEGRATION_PROVISION] ' + JSON.stringify(result));
  return result;
}

function getMissingIntegrationConfigurationKeys_() {
  const configuration = getIntegrationTestConfiguration_();
  return [
    'TEST_SPREADSHEET_ID',
    'TEST_CALENDAR_ID',
    'TEST_EVALUATION_FOLDER_ID',
    'TEST_CHAT_WEBHOOK_URL',
    'TEST_MAIL_RECIPIENT'
  ].filter(key => !configuration[key]);
}

/**
 * テスト専用Chat WebhookをScript Propertiesへ保存する。
 * @param {Object=} options
 * @returns {Object}
 */
function configureIntegrationTestChatWebhook(options) {
  const guard = GaosysIntegrationTest.prepareChatWebhook(options);
  if (!guard.ok) return guard;

  PropertiesService.getScriptProperties().setProperty(
    'TEST_CHAT_WEBHOOK_URL',
    options.webhookUrl.trim()
  );
  const result = {
    ok: true,
    configured: true,
    missing: getMissingIntegrationConfigurationKeys_()
  };
  console.log('[GAOSYS_INTEGRATION_CHAT_CONFIG] ' + JSON.stringify(result));
  return result;
}
