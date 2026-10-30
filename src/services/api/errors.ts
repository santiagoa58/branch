export class ApiError extends Error {
  readonly cause?: unknown;

  constructor(
    public status: number,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.cause = cause;
  }
}

export class ApiRequestValidationError extends Error {
  readonly cause: unknown;

  constructor(method: string, path: string, cause: unknown) {
    super(`Cannot send ${method} ${path}: the request data does not match the API contract.`);
    this.name = "ApiRequestValidationError";
    this.cause = cause;
  }
}

export class ApiResponseValidationError extends Error {
  readonly cause: unknown;

  constructor(method: string, path: string, cause: unknown) {
    super(
      `Invalid response from ${method} ${path}: the backend response does not match the API contract.`,
    );
    this.name = "ApiResponseValidationError";
    this.cause = cause;
  }
}
