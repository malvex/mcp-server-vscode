import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // The path to the test workspace
    const testWorkspace = path.resolve(__dirname, '../../test-workspace');

    // Parse command line arguments for mocha options
    const args = process.argv.slice(2);
    const grepIndex = args.indexOf('--grep');
    if (grepIndex !== -1 && args[grepIndex + 1]) {
      process.env.MOCHA_GREP = args[grepIndex + 1];
    }

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        '--disable-telemetry',
        '--disable-crash-reporter',
        '--user-data-dir=/tmp/vscode-test-profile',
      ],
      extensionTestsEnv: {
        ...process.env,
        MOCHA_GREP: process.env.MOCHA_GREP,
        // Disable telemetry and other features that might slow down tests
        VSCODE_SKIP_PRELAUNCH: '1',
        ELECTRON_NO_ATTACH_CONSOLE: '1',
      },
    });
  } catch {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
