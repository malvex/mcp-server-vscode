import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Refactor Tools Tests (Symbol-Based)', () => {
  let context: TestContext;
  const tempFiles: vscode.Uri[] = [];

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
    // Clean up any remaining temp files
    for (const uri of tempFiles) {
      try {
        await vscode.workspace.fs.delete(uri);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // Helper to create temporary test files
  async function createTempFile(name: string, content: string): Promise<vscode.Uri> {
    const uri = vscode.Uri.joinPath(context.workspaceUri, 'src', `temp-test-${Date.now()}-${name}`);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    tempFiles.push(uri);

    // Open and wait for language server
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return uri;
  }

  // Clean up temp files after each test
  teardown(async () => {
    for (const uri of tempFiles) {
      try {
        await vscode.workspace.fs.delete(uri);
      } catch {
        // Ignore cleanup errors
      }
    }
    tempFiles.length = 0;
  });

  suite('Symbol-Based Rename Tests', () => {
    test('should rename function by symbol name', async () => {
      const content = `export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

export function processOrder() {
  const items = [10, 20, 30];
  const total = calculateTotal(items);
  console.log('Total:', total);
}`;

      await createTempFile('rename-test.ts', content);

      // Test renaming by symbol name only
      const result = await callTool('refactor_rename', {
        symbol: 'calculateTotal',
        newName: 'computeSum',
      });

      assert.strictEqual(result.success, true, 'Rename should succeed');
      // Symbol names might include () for functions
      assert.ok(
        result.renamedSymbol.oldName === 'calculateTotal' ||
          result.renamedSymbol.oldName === 'calculateTotal()',
        `Expected 'calculateTotal' or 'calculateTotal()' but got '${result.renamedSymbol.oldName}'`
      );
      assert.strictEqual(result.renamedSymbol.newName, 'computeSum');
      assert.ok(result.filesChanged > 0, 'Should have changed files');
      assert.ok(result.totalEdits >= 2, 'Should have at least 2 edits (definition + usage)');
    });

    test('should provide suggestions for misspelled symbol', async () => {
      const content = `export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}`;

      await createTempFile('suggestions-test.ts', content);

      // Test with misspelled symbol name
      const result = await callTool('refactor_rename', {
        symbol: 'calculteTotal', // Missing 'a'
        newName: 'computeSum',
      });

      assert.ok(result.error, 'Should return an error');
      assert.ok(result.suggestions, 'Should provide suggestions');
      assert.ok(result.suggestions.length > 0, 'Should have at least one suggestion');
      assert.ok(
        result.suggestions.some(
          (s: any) => s.name === 'calculateTotal' || s.name === 'calculateTotal()'
        ),
        'Should suggest the correct name'
      );
      assert.ok(
        result.hint.includes('calculateTotal'),
        `Hint should mention the correct name. Got hint: "${result.hint}"`
      );
    });

    test('should handle multiple matches with disambiguation', async () => {
      const content1 = `export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}`;

      const content2 = `export function add(x: number, y: number): number {
  return x + y;
}`;

      await createTempFile('class-test.ts', content1);
      await createTempFile('function-test.ts', content2);

      // Test with ambiguous symbol name
      const result = await callTool('refactor_rename', {
        symbol: 'add',
        newName: 'sum',
      });

      assert.ok(result.multipleMatches, 'Should indicate multiple matches');
      assert.ok(result.matches, 'Should provide match details');
      assert.ok(result.matches.length >= 2, 'Should have at least 2 matches');
      assert.ok(
        result.hint.includes('qualified name'),
        'Hint should suggest using qualified names'
      );
    });

    test('should rename with file URI disambiguation', async () => {
      const content = `export function processData(data: any): void {
  console.log('Processing:', data);
}`;

      const uri = await createTempFile('uri-test.ts', content);

      // Test with URI to disambiguate
      const result = await callTool('refactor_rename', {
        symbol: 'processData',
        newName: 'handleData',
        uri: uri.toString(),
      });

      assert.strictEqual(result.success, true, 'Rename should succeed');
      assert.ok(
        result.renamedSymbol.oldName === 'processData' ||
          result.renamedSymbol.oldName === 'processData()',
        `Expected 'processData' or 'processData()' but got '${result.renamedSymbol.oldName}'`
      );
      assert.strictEqual(result.renamedSymbol.newName, 'handleData');
    });
  });

  suite('Compact vs Detailed Format Tests', () => {
    test('should return compact format by default', async () => {
      const content = `export const PI = 3.14159;`;
      await createTempFile('compact-test.ts', content);

      const result = await callTool('refactor_rename', {
        symbol: 'PI',
        newName: 'MATH_PI',
      });

      if (result.success) {
        assert.ok(!result.changes, 'Compact format should not include detailed changes');
        assert.ok(result.filesChanged !== undefined, 'Should include file count');
        assert.ok(result.totalEdits !== undefined, 'Should include edit count');
      }
    });

    test('should return detailed format when requested', async () => {
      const content = `export const PI = 3.14159;`;
      await createTempFile('detailed-test.ts', content);

      const result = await callTool('refactor_rename', {
        symbol: 'PI',
        newName: 'MATH_PI',
        format: 'detailed',
      });

      if (result.success) {
        assert.ok(result.changes, 'Detailed format should include changes');
        assert.ok(result.renamedSymbol.kind, 'Should include symbol kind');
        assert.ok(result.renamedSymbol.location, 'Should include location');
      }
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('should handle external/non-renameable symbols', async () => {
      const content = `import { readFile } from 'fs';

export function loadData() {
  readFile('data.txt', (err, data) => {
    console.log(data);
  });
}`;

      await createTempFile('external-test.ts', content);

      const result = await callTool('refactor_rename', {
        symbol: 'readFile',
        newName: 'readFileSync',
      });

      // Should either fail or indicate it's external
      assert.ok(
        result.error || !result.success,
        `Expected an error for external symbol. Got result: ${JSON.stringify(result)}`
      );

      if (result.error) {
        assert.ok(
          result.error.includes('No symbol found') ||
            result.error.includes('external') ||
            result.error.includes('not be renameable'),
          `Error should indicate why rename failed. Got error: "${result.error}"`
        );
      }
    });

    test('should validate required parameters', async () => {
      // Missing newName
      const result1 = await callTool('refactor_rename', {
        symbol: 'someSymbol',
      });
      assert.ok(result1.error, 'Should error on missing newName');

      // Missing symbol
      const result2 = await callTool('refactor_rename', {
        newName: 'newName',
      });
      assert.ok(result2.error, 'Should error on missing symbol');
    });
  });
});
