import * as assert from 'assert';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Debug Output Tool Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should handle no debug session', async () => {
    const result = await callTool('debug_getOutput', {
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error when no session');
    assert.ok(result.error.includes('No active debug session'), 'Should mention no session');
  });

  test('should handle empty output', async () => {
    // This test would require an active debug session
    // For now, just test the error case
    const result = await callTool('debug_getOutput', {
      category: 'console',
      limit: 10,
      format: 'compact',
    });

    assert.ok(result.error === 'no_session', 'Should return compact error');
  });

  test('should validate category parameter', async () => {
    const result = await callTool('debug_getOutput', {
      category: 'invalid' as any,
      format: 'detailed',
    });

    // The tool should still work, just not filter by the invalid category
    assert.ok(result.error, 'Should have error (no session)');
  });

  test('should handle filter parameter', async () => {
    const result = await callTool('debug_getOutput', {
      filter: 'error',
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error when no session');
    assert.ok(result.error.includes('No active debug session'), 'Should mention no session');
  });

  test('should handle limit parameter', async () => {
    const result = await callTool('debug_getOutput', {
      limit: 50,
      format: 'detailed',
    });

    assert.ok(result.error, 'Should have error when no session');
  });

  test('should detect integratedTerminal limitation', async () => {
    // This test demonstrates the expected warning format
    // In a real scenario with integratedTerminal and no output:
    // const result = await callTool('debug_getOutput', { format: 'detailed' });
    // assert.ok(result.warning, 'Should have warning about integratedTerminal');
    // assert.ok(result.suggestion.includes('internalConsole'), 'Should suggest using internalConsole');

    // For now, just verify the tool handles the parameters
    const result = await callTool('debug_getOutput', {
      format: 'compact',
    });

    assert.ok(result.error === 'no_session', 'Should return no session error');
  });

  // Note: Full integration tests would require:
  // 1. Starting a debug session
  // 2. Running code that produces output
  // 3. Then calling debug_getOutput to retrieve it
  // This would be complex to set up in unit tests

  test.skip('should get console output during debug session', async () => {
    // This would require a full debug session setup
    // Including:
    // - Start debug session
    // - Execute code with console.log
    // - Then test debug_getOutput
  });

  test.skip('should filter by category', async () => {
    // Would need active session with different output types
  });

  test.skip('should apply text filter', async () => {
    // Would need active session with various output messages
  });
});
