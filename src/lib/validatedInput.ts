import type { ZodType } from "zod";

/** Apply browser input only after its domain schema succeeds. */
export function applyValidatedInput<T>(
  schema: ZodType<T>,
  input: unknown,
  apply: (value: T) => void,
): void {
  const result = schema.safeParse(input);
  if (result.success) {
    apply(result.data);
  }
}
