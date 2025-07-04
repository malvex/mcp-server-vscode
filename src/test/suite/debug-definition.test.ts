import * as assert from 'assert';
import * as vscode from 'vscode';
import { setupTest, teardownTest, openTestFile, TestContext } from '../helpers/testHelpers';

suite('Debug Definition Provider', () => {
  let context: TestContext;

  suiteSetup(async () => {
    context = await setupTest();
  });

  suiteTeardown(async () => {
    await teardownTest(context);
  });

  test('should check if TypeScript extension is active', async () => {
    // Check if TypeScript extension is available
    const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
    assert.ok(tsExtension, 'TypeScript extension should be available');
    assert.ok(tsExtension.isActive, 'TypeScript extension should be active');
  });

  test('should test definition provider directly', async () => {
    const document = await openTestFile('app.ts');

    // Try different ways to get definition
    const position = new vscode.Position(4, 38); // 'add' function call

    // Method 1: Direct command
    const definitions1 = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      document.uri,
      position
    );

    console.log('Method 1 results:', definitions1?.length || 0);

    // Method 2: Using TypeScript specific command
    try {
      const definitions2 = await vscode.commands.executeCommand(
        'typescript.goToSourceDefinition',
        document.uri,
        position
      );
      console.log('Method 2 results:', definitions2);
    } catch (e) {
      console.log('Method 2 error:', e);
    }

    // Method 3: Check available commands
    const allCommands = await vscode.commands.getCommands();
    const tsCommands = allCommands.filter((cmd) => cmd.includes('typescript'));
    console.log('Available TypeScript commands:', tsCommands.slice(0, 10));

    // Check if document is recognized as TypeScript
    console.log('Document language:', document.languageId);
    console.log('Document URI:', document.uri.toString());
    console.log('Document line count:', document.lineCount);

    // Check the actual text at the position
    const line = document.lineAt(position.line);
    console.log('Line text:', line.text);
    console.log('Character at position:', line.text[position.character]);
  });

  test('should check workspace configuration', async () => {
    // Check TypeScript settings
    const config = vscode.workspace.getConfiguration('typescript');
    console.log('TypeScript tsdk:', config.get('tsdk'));
    console.log('TypeScript enable:', config.get('enablePromptUseWorkspaceTsdk'));

    // Check if we have a tsconfig
    const tsconfigUri = vscode.Uri.joinPath(context.workspaceUri, 'tsconfig.json');
    try {
      const tsconfig = await vscode.workspace.fs.readFile(tsconfigUri);
      console.log('tsconfig.json exists:', tsconfig.length > 0);
    } catch {
      console.log('No tsconfig.json found in test workspace');
    }
  });
});
