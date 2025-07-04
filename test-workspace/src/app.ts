import { add, multiply, Calculator } from './math';

// Test function that uses math functions
function calculateSum(numbers: number[]): number {
  return numbers.reduce((sum, num) => add(sum, num), 0);
}

// Test function that uses Calculator class
function performCalculations(): void {
  const calc = new Calculator();

  calc.add(10).add(20).add(30);

  const result = calc.getResult();
  console.log('Result:', result);

  // This will cause an error if uncommented
  // const invalid: string = calc.getResult();
}

// Function with type error for testing diagnostics
function hasTypeError() {
  const num: number = 'not a number'; // Type error
  return num;
}

// Unused variable for testing diagnostics
const unusedVariable = 42;

// Call the functions
calculateSum([1, 2, 3, 4, 5]);
performCalculations();
