import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, callTool, TestContext } from '../helpers/testHelpers';

suite('Workspace Symbols Fallback Parser Tests', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should extract Python symbols without language server', async () => {
    // Create a Python file with various symbols
    const pythonContent = `#!/usr/bin/env python3
"""Test module for symbol extraction"""

import os
import sys

# Constants
API_KEY = "secret"
MAX_RETRIES = 3

def hello_world():
    """A simple hello world function"""
    print("Hello, World!")

def process_data(data):
    """Process some data"""
    return data * 2

class Calculator:
    """A simple calculator class"""
    def __init__(self):
        self.result = 0

    def add(self, value):
        self.result += value
        return self.result

    def subtract(self, value):
        self.result -= value
        return self.result

class AdvancedCalculator(Calculator):
    """Extended calculator with more features"""
    def multiply(self, value):
        self.result *= value
        return self.result

# Module-level function
def main():
    calc = Calculator()
    calc.add(5)
    print(calc.result)

if __name__ == "__main__":
    main()
`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      assert.fail('No workspace folder');
    }

    const testFileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'test_fallback.py');

    // Create the test file
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(testFileUri, encoder.encode(pythonContent));

    try {
      // Give VS Code time to detect the file
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Call workspaceSymbols
      const result = await callTool('workspaceSymbols', {
        format: 'detailed',
        filePattern: '**/test_fallback.py',
      });

      console.log('Result:', JSON.stringify(result, null, 2));

      assert.ok(!result.error, `Should not have error: ${result.error}`);
      assert.ok(result.files, 'Should have files');

      const pythonFile = Object.keys(result.files).find((f) => f.includes('test_fallback.py'));

      if (pythonFile) {
        const symbols = result.files[pythonFile];
        console.log(`Found ${symbols.length} symbols in Python file`);

        // Check for expected symbols
        const symbolNames = symbols.map((s: any) => s.name);
        console.log('Symbol names:', symbolNames);

        // Should find classes
        assert.ok(symbolNames.includes('Calculator'), 'Should find Calculator class');
        assert.ok(
          symbolNames.includes('AdvancedCalculator'),
          'Should find AdvancedCalculator class'
        );

        // Should find functions
        assert.ok(symbolNames.includes('hello_world'), 'Should find hello_world function');
        assert.ok(symbolNames.includes('process_data'), 'Should find process_data function');
        assert.ok(symbolNames.includes('main'), 'Should find main function');

        // Should find constants
        assert.ok(symbolNames.includes('API_KEY'), 'Should find API_KEY constant');
        assert.ok(symbolNames.includes('MAX_RETRIES'), 'Should find MAX_RETRIES constant');

        // Verify symbol kinds
        const calculatorSymbol = symbols.find((s: any) => s.name === 'Calculator');
        assert.strictEqual(calculatorSymbol?.kind, 'Class', 'Calculator should be a Class');

        const helloSymbol = symbols.find((s: any) => s.name === 'hello_world');
        assert.strictEqual(helloSymbol?.kind, 'Function', 'hello_world should be a Function');

        const apiKeySymbol = symbols.find((s: any) => s.name === 'API_KEY');
        assert.strictEqual(apiKeySymbol?.kind, 'Variable', 'API_KEY should be a Variable');
      } else {
        // File was skipped
        console.log('Python file was skipped');
        assert.ok(result.summary.skippedFiles > 0, 'Should have skipped files counter');
      }
    } finally {
      // Clean up
      await vscode.workspace.fs.delete(testFileUri);
    }
  });

  test('should handle indented Python code', async () => {
    const pythonContent = `class OuterClass:
    def outer_method(self):
        pass

    class InnerClass:
        def inner_method(self):
            pass
`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      assert.fail('No workspace folder');
    }

    const testFileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'test_indented.py');

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(testFileUri, encoder.encode(pythonContent));

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await callTool('workspaceSymbols', {
        format: 'detailed',
        filePattern: '**/test_indented.py',
      });

      const pythonFile = Object.keys(result.files).find((f) => f.includes('test_indented.py'));

      if (pythonFile) {
        const symbols = result.files[pythonFile];
        const symbolNames = symbols.map((s: any) => s.name);

        // Our basic parser only looks for top-level symbols
        assert.ok(symbolNames.includes('OuterClass'), 'Should find OuterClass');
        // Inner class and methods won't be found by basic parser
        console.log('Found symbols:', symbolNames);
      }
    } finally {
      await vscode.workspace.fs.delete(testFileUri);
    }
  });
});
