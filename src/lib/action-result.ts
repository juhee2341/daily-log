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

/** requireUser/requireMember/requireHost 의 AuthError를 실패 결과로 바꾼다. 그 밖의 에러는 다시 던진다. */
export function authFailure(error: unknown) {
  if (error instanceof Error && error.name === "AuthError") {
    const { code, message } = error as Error & { code: "UNAUTHORIZED" | "NOT_FOUND" };
    return fail(code, message);
  }
  throw error;
}
