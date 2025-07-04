import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // Create the mocha test
  const mochaOptions: Mocha.MochaOptions = {
    ui: 'tdd',
    color: true,
    timeout: 60000, // 60 seconds for each test (VS Code operations can be slow)
  };

  // Check for grep pattern from environment variable
  if (process.env.MOCHA_GREP) {
    mochaOptions.grep = process.env.MOCHA_GREP;
  }

  const mocha = new Mocha(mochaOptions);

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((c, e) => {
    const pattern = '**/**.test.js';
    const options = { cwd: testsRoot };

    glob(pattern, options)
      .then((files: string[]) => {
        // Add files to the test suite
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
          mocha.run((failures: number) => {
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
