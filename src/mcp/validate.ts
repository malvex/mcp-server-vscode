/**
 * Validates tool arguments against the tool's input schema
 */
export function validateToolArguments(args: any, schema: any): { valid: boolean; error?: string } {
  if (!schema || !schema.properties) {
    return { valid: true };
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        return {
          valid: false,
          error: `Missing required field: ${field}`,
        };
      }
    }
  }

  // Basic type validation for each property
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (args[key] !== undefined && args[key] !== null) {
        const value = args[key];
        const expectedType = (propSchema as any).type;

        if (expectedType) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (expectedType !== actualType) {
            return {
              valid: false,
              error: `Invalid type for field '${key}': expected ${expectedType}, got ${actualType}`,
            };
          }
        }

        // Validate enum values
        const enumValues = (propSchema as any).enum;
        if (enumValues && Array.isArray(enumValues)) {
          if (!enumValues.includes(value)) {
            return {
              valid: false,
              error: `Invalid value for field '${key}': must be one of ${enumValues.join(', ')}`,
            };
          }
        }
      }
    }
  }

  return { valid: true };
}
