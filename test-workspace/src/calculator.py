"""Calculator module for testing symbol extraction."""

class BasicCalculator:
    """A basic calculator with simple operations."""

    def __init__(self):
        self.memory = 0
        self.history = []

    def add(self, a, b):
        """Add two numbers."""
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result

    def subtract(self, a, b):
        """Subtract b from a."""
        result = a - b
        self.history.append(f"{a} - {b} = {result}")
        return result

    def store_in_memory(self, value):
        """Store a value in memory."""
        self.memory = value

    def recall_memory(self):
        """Recall the stored memory value."""
        return self.memory

class ScientificCalculator(BasicCalculator):
    """Extended calculator with scientific operations."""

    def power(self, base, exponent):
        """Calculate base raised to the power of exponent."""
        result = base ** exponent
        self.history.append(f"{base} ^ {exponent} = {result}")
        return result

    def square_root(self, value):
        """Calculate the square root of a value."""
        if value < 0:
            raise ValueError("Cannot calculate square root of negative number")
        result = value ** 0.5
        self.history.append(f"√{value} = {result}")
        return result

def calculate_average(numbers):
    """Calculate the average of a list of numbers."""
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

# Global constant
PI = 3.14159265359
