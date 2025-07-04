import * as path from 'path';

export class VSCodeReporter {
  private passes = 0;
  private failures = 0;
  private currentSuite = '';

  constructor(runner: any, _options?: any) {
    runner.on('suite', (suite: any) => {
      if (suite.title) {
        this.currentSuite = suite.title;
      }
    });

    runner.on('pass', (test: any) => {
      this.passes++;
      console.log(`✓ ${this.currentSuite} > ${test.title}`);
    });

    runner.on('fail', (test: any, err: any) => {
      this.failures++;

      // Output in a format that VS Code problem matcher can parse
      console.log(`FAIL: ${this.currentSuite} > ${test.title}`);

      if (err.stack) {
        // Parse the stack trace to find the test file location
        const stackLines = err.stack.split('\n');
        const testFilePattern = /at\s+.*?\s+\((.*?):(\d+):(\d+)\)/;
        const testFilePatternAlt = /at\s+(.*?):(\d+):(\d+)/;

        for (const line of stackLines) {
          const match = testFilePattern.exec(line) || testFilePatternAlt.exec(line);
          if (match && match[1].includes('test') && !match[1].includes('node_modules')) {
            const filePath = match[1];
            const lineNumber = match[2];
            const columnNumber = match[3];

            // Convert absolute path to relative if needed
            const relativePath = path.relative(process.cwd(), filePath);

            // Output in format: file:line:column: error: message
            console.log(
              `${relativePath}:${lineNumber}:${columnNumber}: error: ${test.title} - ${err.message}`
            );
            break;
          }
        }
      } else {
        console.log(`${test.file || 'unknown'}:1:1: error: ${test.title} - ${err.message}`);
      }

      // Also output the error message
      console.log(`  ${err.message}`);
      if (err.stack) {
        console.log(err.stack.split('\n').slice(1, 3).join('\n'));
      }
    });

    runner.once('end', () => {
      console.log(`\nTest Summary: ${this.passes} passing, ${this.failures} failing`);

      // Exit with error code if tests failed
      if (this.failures > 0) {
        process.exitCode = 1;
      }
    });
  }
}
