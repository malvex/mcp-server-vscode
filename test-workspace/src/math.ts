/**
 * Adds two numbers together
 * @param a First number
 * @param b Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies two numbers
 * @param a First number
 * @param b Second number
 * @returns The product of a and b
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

export class Calculator {
  private result: number = 0;

  /**
   * Adds a number to the current result
   */
  add(value: number): Calculator {
    this.result += value;
    return this;
  }

  /**
   * Gets the current result
   */
  getResult(): number {
    return this.result;
  }

  /**
   * Resets the calculator
   */
  reset(): void {
    this.result = 0;
  }
}
