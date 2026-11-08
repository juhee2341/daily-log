export type ActionErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; code: ActionErrorCode; fieldErrors?: Record<string, string[] | undefined> };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(
  code: ActionErrorCode,
  error: string,
  fieldErrors?: Record<string, string[] | undefined>,
): { success: false; error: string; code: ActionErrorCode; fieldErrors?: Record<string, string[] | undefined> } {
  return { success: false, error, code, fieldErrors };
}
