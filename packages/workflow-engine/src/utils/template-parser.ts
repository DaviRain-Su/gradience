/**
 * Template Variable Parser
 * Parses {{stepX.output.field}} syntax in workflow parameters
 */
import type { StepResult } from '../schema/types.js';

/**
 * Context for template parsing - maps step IDs to their results
 */
export type TemplateContext = Map<string, StepResult>;

/**
 * Pattern to match template variables
 * Supports: {{stepId.property}} and {{stepId.property.nested.path}}
 */
const TEMPLATE_PATTERN = /\{\{(\w+)\.(\w+(?:\.\w+)*)\}\}/g;

/**
 * Get a nested property from an object using dot notation
 * @param obj The object to get the property from
 * @param path The dot-separated path (e.g., "output.data.value")
 * @returns The value at the path, or undefined if not found
 */
function getNestedProperty(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Parse template variables in a string
 * 
 * @param template The string containing template variables
 * @param context Map of step IDs to their results
 * @returns The string with variables replaced, or original text if variable not found
 * 
 * @example
 * ```typescript
 * const context = new Map([
 *   ['step1', { stepId: 'step1', output: { value: 100, data: { nested: 'hello' } } }]
 * ]);
 * 
 * parseTemplate('Amount: {{step1.output.value}}', context);
 * // Returns: 'Amount: 100'
 * 
 * parseTemplate('{{step1.output.data.nested}}', context);
 * // Returns: 'hello'
 * 
 * parseTemplate('{{unknown.output.value}}', context);
 * // Returns: '{{unknown.output.value}}' (unchanged)
 * ```
 */
export function parseTemplate(template: string, context: TemplateContext): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(TEMPLATE_PATTERN, (match, stepId: string, propertyPath: string) => {
    // Get the step result from context
    const stepResult = context.get(stepId);
    if (!stepResult) {
      return match; // Keep original if step not found
    }

    // Handle direct StepResult properties (e.g., {{step1.txHash}})
    const firstPart = propertyPath.split('.')[0];
    
    if (firstPart === 'output') {
      // Access output properties: {{step1.output.field}}
      const outputPath = propertyPath.substring('output.'.length);
      if (!outputPath) {
        // Just {{step1.output}} - return the whole output
        const value = stepResult.output;
        return value !== undefined ? String(value) : match;
      }
      const value = getNestedProperty(stepResult.output, outputPath);
      return value !== undefined ? String(value) : match;
    } else {
      // Access StepResult properties directly: {{step1.txHash}}, {{step1.status}}
      const value = getNestedProperty(stepResult, propertyPath);
      return value !== undefined ? String(value) : match;
    }
  });
}

/**
 * Parse template variables in any value (string, object, or array)
 * Recursively processes nested structures
 * 
 * @param value The value to parse
 * @param context Map of step IDs to their results
 * @returns The value with all template variables replaced
 */
export function parseTemplateValue(value: unknown, context: TemplateContext): unknown {
  if (typeof value === 'string') {
    return parseTemplate(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => parseTemplateValue(item, context));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = parseTemplateValue(val, context);
    }
    return result;
  }

  // Return primitives (number, boolean, null, undefined) as-is
  return value;
}

/**
 * Check if a string contains template variables
 */
export function hasTemplateVariables(value: string): boolean {
  // Create a new regex instance to avoid state issues with global flag
  const pattern = /\{\{(\w+)\.(\w+(?:\.\w+)*)\}\}/;
  return pattern.test(value);
}

/**
 * Extract all template variable references from a string
 * @returns Array of { stepId, propertyPath } objects
 */
export function extractTemplateVariables(
  template: string
): Array<{ stepId: string; propertyPath: string }> {
  const variables: Array<{ stepId: string; propertyPath: string }> = [];
  const pattern = /\{\{(\w+)\.(\w+(?:\.\w+)*)\}\}/g;
  let match;

  while ((match = pattern.exec(template)) !== null) {
    variables.push({
      stepId: match[1],
      propertyPath: match[2],
    });
  }

  return variables;
}
