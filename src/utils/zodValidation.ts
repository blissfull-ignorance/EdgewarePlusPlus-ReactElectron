import { type ZodIssue } from "zod";
import { CONFIG_ITEMS } from "../types/config";

export interface ValidationIssue {
  key: string;
  message: string;
}

/**
 * Validate settings against the Zod schema definitions.
 * Returns an array of human-readable validation issues, or an empty array if valid.
 */
export function validateSettings(settings: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [key, schema] of Object.entries(CONFIG_ITEMS)) {
    const value = settings[key];

    if (value === undefined || value === null) {
      continue;
    }

    try {
      schema.parse(value);
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: ZodIssue[] };
        for (const issue of zodError.issues) {
          issues.push({
            key,
            message: formatZodIssue(issue, key),
          });
        }
      } else if (error instanceof Error) {
        issues.push({
          key,
          message: error.message,
        });
      } else {
        issues.push({
          key,
          message: `Invalid value: ${String(value)}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Convert a Zod issue into a user-friendly message.
 * Works with both Zod 3 and Zod 4 issue formats.
 */
function formatZodIssue(issue: ZodIssue, key: string): string {
  if (issue.message) {
    return issue.message.includes(key) ? issue.message : `${key}: ${issue.message}`;
  }

  const code = issue.code;
  if (typeof code === "string") {
    return `${key}: ${code}`;
  }

  return `${key}: validation failed`;
}
