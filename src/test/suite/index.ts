import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';
import { glob } from 'glob';
import { cleanupSharedContext } from '../helpers/sharedSetup';
import { VSCodeReporter } from './mochaReporter';

export function run(): Promise<void> {
  // Create the mocha test
  const mochaOptions: Mocha.MochaOptions = {
    ui: 'tdd',
    color: true,
    timeout: 60000, // 60 seconds for each test (VS Code operations can be slow)
    parallel: false, // Run tests sequentially to avoid port conflicts
    reporter: process.env.VSCODE_TEST_REPORTER === 'default' ? 'spec' : (VSCodeReporter as any),
  };

  // Check for grep pattern from environment variable
  if (process.env.MOCHA_GREP) {
    mochaOptions.grep = process.env.MOCHA_GREP;
  }

  const mocha = new Mocha(mochaOptions);

  const testsRoot = path.resolve(__dirname, '.');

  // Clean up before running tests
  cleanupTestWorkspace();

  return new Promise((c, e) => {
    const pattern = '**/**.test.js';
    const options = { cwd: testsRoot };

    glob(pattern, options)
      .then((files: string[]) => {
        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
          mocha.run(async (failures: number) => {
            // Clean up shared context after all tests
            await cleanupSharedContext();

            if (failures > 0) {
              e(new Error(`${failures} tests failed.`));
            } else {
              c();
            }
          });
        } catch (err) {
          console.error(err);
          e(err);
        }
      })
      .catch((err: Error) => {
        e(err);
      });
  });
}

/**
 * Clean up test workspace before running tests
 */
function cleanupTestWorkspace() {
  // Clean up any leftover temp files from previous test runs
  try {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const testWorkspace = path.join(workspaceRoot, 'test-workspace', 'src');

    if (fs.existsSync(testWorkspace)) {
      const files = fs.readdirSync(testWorkspace);
      for (const file of files) {
        if (file.match(/^temp-test-\d+.*\.(ts|js)$/)) {
          try {
            fs.unlinkSync(path.join(testWorkspace, file));
            console.log(`Cleaned up leftover temp file: ${file}`);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
  } catch {
    // Ignore if test workspace doesn't exist
  }
}
