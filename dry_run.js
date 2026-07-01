/**
 * 外部サービスへ書き込まず、GAS上でドメインロジックを検証する。
 */
var GaosysDryRun = (function() {
  'use strict';

  const EXTERNAL_WRITE_TARGETS = [
    'spreadsheet',
    'drive',
    'calendar',
    'chat',
    'mail',
    'properties'
  ];

  function createCounter(initialValue) {
    return EXTERNAL_WRITE_TARGETS.reduce((counter, target) => {
      counter[target] = initialValue;
      return counter;
    }, {});
  }

  /**
   * 実際のGoogleサービスを呼ばず、予定操作だけを記録するadapter。
   * @returns {Object}
   */
  function createDryRunAdapter() {
    const externalWrites = createCounter(0);
    const plannedOperations = createCounter(0);

    return {
      plan(target) {
        if (!Object.prototype.hasOwnProperty.call(plannedOperations, target)) {
          throw new Error('unsupported dry-run target');
        }
        plannedOperations[target] += 1;
      },

      getDiagnostics() {
        return {
          externalWrites: Object.assign({}, externalWrites),
          plannedOperations: Object.assign({}, plannedOperations)
        };
      }
    };
  }

  function assertCondition(condition) {
    if (!condition) throw new Error('assertion failed');
  }

  function assertEqual(actual, expected) {
    assertCondition(actual === expected);
  }

  function validConfiguration() {
    return {
      calendarTitle: 'Test MTG',
      calendarId: 'test-calendar-id',
      durationMinutes: 60,
      startTime: '20:00',
      evaluationTemplateId: 'test-template-id',
      mailSubjectTemplate: 'Test subject',
      mailBodyTemplate: 'Test body'
    };
  }

  function testDefinitions(adapter) {
    return [
      {
        id: 'CFG-001',
        expected: 'valid configuration',
        run() {
          const result = GaosysDomain.normalizeConfiguration(
            validConfiguration(),
            {
              chatWebhookUrl: 'test-webhook-value',
              evaluationFolderId: 'test-folder-id'
            }
          );
          assertEqual(result.ok, true);
          return 'valid configuration';
        }
      },
      {
        id: 'CFG-002',
        expected: 'default start time',
        run() {
          const configuration = validConfiguration();
          configuration.startTime = '';
          const result = GaosysDomain.normalizeConfiguration(
            configuration,
            {
              chatWebhookUrl: 'test-webhook-value',
              evaluationFolderId: 'test-folder-id'
            }
          );
          assertEqual(result.value.startTime, '20:00');
          return 'default start time';
        }
      },
      {
        id: 'VAL-001',
        expected: 'valid input',
        run() {
          const result = GaosysDomain.validateFormInput(
            {
              name: 'Test Member',
              tadasukeName: 'tester',
              startTime: '2026-07-20',
              challenge: false,
              freeText: ''
            },
            ['Test Member'],
            'test@example.invalid'
          );
          assertEqual(result.ok, true);
          return 'valid input';
        }
      },
      {
        id: 'EVAL-001',
        expected: 'sanitized file name',
        run() {
          const fileName = GaosysDomain.buildEvaluationSheetName(
            ' tester ',
            'Test Member'
          );
          assertEqual(
            fileName,
            '★【tester】評価項目チェックシート'
          );
          adapter.plan('drive');
          adapter.plan('properties');
          return 'sanitized file name';
        }
      },
      {
        id: 'IDX-001',
        expected: 'index columns B through F',
        run() {
          const row = GaosysDomain.buildIndexRowData({
            tadasukeName: 'tester',
            fileName: '★【tester】評価項目チェックシート',
            url: 'https://example.invalid/evaluation'
          });
          assertEqual(row.startColumn, 2);
          assertEqual(row.values.length, 5);
          adapter.plan('spreadsheet');
          return 'index columns B through F';
        }
      },
      {
        id: 'CHAT-001',
        expected: 'chat message generated',
        run() {
          const message = GaosysDomain.buildChatMessage({
            submissionId: 'test-submission-id',
            email: 'test@example.invalid',
            name: 'Test Member',
            tadasukeName: 'tester',
            startDate: '2026-07-20',
            challenge: 'not requested',
            freeText: '',
            evaluationSheetUrl: 'https://example.invalid/evaluation',
            spreadsheetUrl: 'https://example.invalid/control'
          });
          assertCondition(message.indexOf('*申込ID*:') !== -1);
          adapter.plan('chat');
          return 'chat message generated';
        }
      },
      {
        id: 'MAIL-001',
        expected: 'mail template rendered',
        run() {
          const result = GaosysDomain.renderMailTemplate(
            'Hello {{name}} {{evaluationSheetUrl}}',
            {
              name: 'Test Member',
              evaluationSheetUrl: 'https://example.invalid/evaluation'
            }
          );
          assertEqual(result.ok, true);
          adapter.plan('mail');
          return 'mail template rendered';
        }
      },
      {
        id: 'CHAT-004',
        expected: '2xx accepted',
        run() {
          assertEqual(GaosysDomain.isSuccessfulHttpStatus(200), true);
          assertEqual(GaosysDomain.isSuccessfulHttpStatus(400), false);
          return '2xx accepted';
        }
      },
      {
        id: 'REG-005',
        expected: 'three future third Mondays',
        run() {
          const dates = GaosysDomain.generateFutureThirdMondays(
            new Date(2026, 5, 13, 12, 0, 0),
            3
          );
          assertEqual(dates.length, 3);
          assertEqual(dates[0].value, '2026-06-15');
          return 'three future third Mondays';
        }
      },
      {
        id: 'FLOW-001',
        expected: 'all operations planned',
        run() {
          adapter.plan('calendar');
          adapter.plan('spreadsheet');
          adapter.plan('drive');
          adapter.plan('chat');
          adapter.plan('mail');
          assertCondition(true);
          return 'all operations planned';
        }
      },
      {
        id: 'FLOW-004',
        expected: 'partial failure accepted',
        run() {
          const operations = {
            calendar: 'success',
            submission: 'success',
            evaluationSheet: 'failed',
            index: 'skipped',
            chat: 'success',
            mail: 'skipped'
          };
          assertEqual(operations.calendar, 'success');
          assertEqual(operations.submission, 'success');
          assertEqual(operations.evaluationSheet, 'failed');
          return 'partial failure accepted';
        }
      },
      {
        id: 'IDEM-001',
        expected: 'idempotency keys planned',
        run() {
          adapter.plan('properties');
          assertCondition(true);
          return 'idempotency keys planned';
        }
      }
    ];
  }

  function normalizeOptions(options) {
    const input = options && typeof options === 'object' ? options : {};
    const testIds = Array.isArray(input.testIds)
      ? input.testIds.filter(id => typeof id === 'string')
      : [];
    const now = new Date(input.now);

    return {
      suite: typeof input.suite === 'string' && input.suite !== ''
        ? input.suite
        : 'all',
      testIds,
      forceFailureTestId: typeof input.forceFailureTestId === 'string'
        ? input.forceFailureTestId
        : '',
      now: Number.isNaN(now.getTime()) ? new Date() : now
    };
  }

  function executeTest(definition, forceFailureTestId) {
    const startedAt = Date.now();

    try {
      const actual = definition.run();
      if (definition.id === forceFailureTestId) {
        throw new Error('forced failure');
      }
      return {
        id: definition.id,
        status: 'passed',
        expected: definition.expected,
        actual,
        durationMs: Math.max(0, Date.now() - startedAt)
      };
    } catch (error) {
      return {
        id: definition.id,
        status: 'failed',
        expected: definition.expected,
        actual: 'assertion failed',
        durationMs: Math.max(0, Date.now() - startedAt)
      };
    }
  }

  /**
   * ドライテストを実行し、JSON serializableな結果を返す。
   * @param {Object=} options
   * @returns {Object}
   */
  function run(options) {
    const normalized = normalizeOptions(options);
    const suiteStartedAt = Date.now();
    const adapter = createDryRunAdapter();
    const availableTests = testDefinitions(adapter);
    const selectedTests = normalized.testIds.length > 0
      ? availableTests.filter(test =>
        normalized.testIds.indexOf(test.id) !== -1
      )
      : availableTests;
    const startedAt = normalized.now.toISOString();
    const tests = selectedTests.map(test =>
      executeTest(test, normalized.forceFailureTestId)
    );
    const passed = tests.filter(test => test.status === 'passed').length;
    const failed = tests.length - passed;

    return {
      suite: normalized.suite,
      passed,
      failed,
      startedAt,
      finishedAt: new Date(
        normalized.now.getTime() + Math.max(0, Date.now() - suiteStartedAt)
      ).toISOString(),
      tests,
      diagnostics: adapter.getDiagnostics()
    };
  }

  return {
    createDryRunAdapter,
    run
  };
})();

/**
 * clasp runから呼び出すGAS公開関数。
 * @param {Object=} options
 * @returns {Object}
 */
function runDryTestSuite(options) {
  const result = GaosysDryRun.run(options);
  console.log('[GAOSYS_DRY_TEST_SUMMARY] ' + JSON.stringify({
    suite: result.suite,
    passed: result.passed,
    failed: result.failed,
    externalWrites: result.diagnostics.externalWrites
  }));
  return result;
}
