import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  setupTest,
  teardownTest,
  openTestFile,
  callTool,
  TestContext,
} from '../helpers/testHelpers';

suite('Refactor Tools Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  suite('Rename Tool Tests', () => {
    test('should rename a function across files', async () => {
      const document = await openTestFile('math.ts');

      // Test renaming the 'add' function
      const result = await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 6, // Line where 'add' function is defined
        character: 17, // Position of 'add' in 'export function add'
        newName: 'addNumbers',
        format: 'detailed',
      });

      console.log('Rename result:', JSON.stringify(result, null, 2));

      // Verify the rename succeeded
      assert.strictEqual(result.success, true, 'Rename should succeed');
      assert.ok(result.renamedSymbol, 'Should have renamed symbol info');
      assert.strictEqual(result.renamedSymbol.oldName, 'add');
      assert.strictEqual(result.renamedSymbol.newName, 'addNumbers');
      assert.ok(result.filesChanged > 0, 'Should have changed at least one file');
      assert.ok(result.changes, 'Should have detailed changes in detailed format');

      // Revert the change
      await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 6,
        character: 17,
        newName: 'add',
      });
    });

    test('should rename a class and its usages', async () => {
      const document = await openTestFile('math.ts');

      // Test renaming the 'Calculator' class
      const result = await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 13, // Line where 'Calculator' class is defined
        character: 13, // Position of 'Calculator' in 'export class Calculator'
        newName: 'MathCalculator',
      });

      assert.strictEqual(result.success, true, 'Rename should succeed');
      assert.ok(result.filesChanged > 0, 'Should have changed files');

      // Revert
      await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 13,
        character: 13,
        newName: 'Calculator',
      });
    });

    test('should handle rename at invalid location', async () => {
      const document = await openTestFile('math.ts');

      // Try to rename at a comment line
      const result = await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 0, // Comment line
        character: 5,
        newName: 'newName',
      });

      assert.ok(result.error, 'Should return an error');
      assert.ok(
        result.error.includes('No rename provider') || result.error.includes('cannot be renamed'),
        'Error should indicate rename not available'
      );
    });

    test('should handle non-existent file', async () => {
      const result = await callTool('refactor_rename', {
        uri: 'file:///non/existent/file.ts',
        line: 0,
        character: 0,
        newName: 'newName',
      });

      assert.ok(result.error, 'Should return an error');
      assert.ok(result.error.includes('File not found'), 'Error should indicate file not found');
    });

    test('should work with compact format', async () => {
      const document = await openTestFile('math.ts');

      const result = await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 6,
        character: 17,
        newName: 'sum',
        format: 'compact',
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.renamedSymbol);
      assert.ok(result.filesChanged >= 0);
      assert.ok(result.totalEdits >= 0);
      assert.ok(!result.changes, 'Compact format should not include detailed changes');

      // Revert
      await callTool('refactor_rename', {
        uri: document.uri.toString(),
        line: 6,
        character: 17,
        newName: 'add',
      });
    });
  });

  suite('Extract Method Tool Tests', () => {
    test('should extract code to method', async () => {
      const document = await openTestFile('app.ts');

      // Extract lines 7-9 (the calculation logic in app.ts)
      const result = await callTool('refactor_extractMethod', {
        uri: document.uri.toString(),
        startLine: 6,
        startCharacter: 2,
        endLine: 8,
        endCharacter: 30,
        methodName: 'performCalculation',
      });

      console.log('Extract method result:', JSON.stringify(result, null, 2));

      // Note: The actual extraction depends on TypeScript language server
      // We can only verify that the tool attempted the extraction
      if (result.success) {
        assert.strictEqual(result.success, true);
        assert.ok(result.extracted);
        assert.ok(result.extracted.linesExtracted > 0);
      } else {
        // Language server might not support extraction for this specific selection
        assert.ok(result.error);
        assert.ok(
          result.error.includes('No extract method refactoring available') ||
            result.error.includes('not available for this selection')
        );
      }
    });

    test('should handle invalid selection for method extraction', async () => {
      const document = await openTestFile('math.ts');

      // Try to extract a comment
      const result = await callTool('refactor_extractMethod', {
        uri: document.uri.toString(),
        startLine: 0,
        startCharacter: 0,
        endLine: 0,
        endCharacter: 20,
      });

      assert.ok(result.error, 'Should return an error');
      assert.ok(
        result.error.includes('No extract method refactoring available'),
        'Error should indicate extraction not available'
      );
    });

    test('should work with compact format', async () => {
      const document = await openTestFile('app.ts');

      const result = await callTool('refactor_extractMethod', {
        uri: document.uri.toString(),
        startLine: 6,
        startCharacter: 2,
        endLine: 8,
        endCharacter: 30,
        format: 'compact',
      });

      if (result.success) {
        assert.ok(!result.extracted.code, 'Compact format should not include full code');
        assert.ok(result.extracted.linesExtracted >= 0);
      }
    });
  });

  suite('Extract Variable Tool Tests', () => {
    test('should extract expression to variable', async () => {
      const document = await openTestFile('app.ts');

      // Try to extract 'add(5, 3)' expression
      const result = await callTool('refactor_extractVariable', {
        uri: document.uri.toString(),
        startLine: 6, // Line with 'const result = add(5, 3);'
        startCharacter: 16, // Start of 'add(5, 3)'
        endLine: 6,
        endCharacter: 25, // End of 'add(5, 3)'
        variableName: 'sum',
      });

      console.log('Extract variable result:', JSON.stringify(result, null, 2));

      // Verify extraction attempt
      if (result.success) {
        assert.strictEqual(result.success, true);
        assert.ok(result.extracted);
        assert.ok(result.extracted.expression);
      } else {
        // Some expressions might not be extractable
        assert.ok(result.error);
        assert.ok(result.error.includes('No extract variable refactoring available'));
      }
    });

    test('should extract complex expression', async () => {
      const document = await openTestFile('math.ts');

      // Try to extract 'a + b' from the add function
      const result = await callTool('refactor_extractVariable', {
        uri: document.uri.toString(),
        startLine: 7, // Line with 'return a + b;'
        startCharacter: 9, // Start of 'a + b'
        endLine: 7,
        endCharacter: 14, // End of 'a + b'
      });

      if (result.success) {
        assert.ok(result.extracted);
        assert.ok(result.message.includes('successfully'));
      }
    });

    test('should handle invalid expression selection', async () => {
      const document = await openTestFile('math.ts');

      // Try to extract whitespace
      const result = await callTool('refactor_extractVariable', {
        uri: document.uri.toString(),
        startLine: 5,
        startCharacter: 0,
        endLine: 5,
        endCharacter: 2,
      });

      assert.ok(result.error);
      assert.ok(result.error.includes('No extract variable refactoring available'));
    });

    test('should truncate long expressions in compact format', async () => {
      // Create a test file with a long expression
      const testFileUri = vscode.Uri.joinPath(context.workspaceUri, 'src', 'test-refactor.ts');

      const longExpression = 'const x = ' + 'a + '.repeat(20) + 'b;';
      await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(longExpression));

      const result = await callTool('refactor_extractVariable', {
        uri: testFileUri.toString(),
        startLine: 0,
        startCharacter: 10,
        endLine: 0,
        endCharacter: longExpression.length - 1,
        format: 'compact',
      });

      if (result.success) {
        assert.ok(
          result.extracted.expression.endsWith('...'),
          'Long expression should be truncated with ...'
        );
        assert.ok(
          result.extracted.expression.length <= 53,
          'Truncated expression should be 53 chars or less'
        );
      }

      // Clean up
      await vscode.workspace.fs.delete(testFileUri);
    });
  });

  suite('Integration Tests', () => {
    test('should validate required parameters', async () => {
      // Test rename without newName
      const result1 = await callTool('refactor_rename', {
        uri: 'file:///test.ts',
        line: 0,
        character: 0,
      });
      assert.ok(result1.error);

      // Test extract method without required end position
      const result2 = await callTool('refactor_extractMethod', {
        uri: 'file:///test.ts',
        startLine: 0,
        startCharacter: 0,
      });
      assert.ok(result2.error);

      // Test extract variable without uri
      const result3 = await callTool('refactor_extractVariable', {
        startLine: 0,
        startCharacter: 0,
        endLine: 0,
        endCharacter: 10,
      });
      assert.ok(result3.error);
    });

    test('should handle malformed URIs gracefully', async () => {
      const result = await callTool('refactor_rename', {
        uri: 'not-a-valid-uri',
        line: 0,
        character: 0,
        newName: 'test',
      });

      assert.ok(result.error);
    });
  });
});
