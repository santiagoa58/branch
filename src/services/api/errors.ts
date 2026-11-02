export class ApiError extends Error {
  readonly cause?: unknown;
  /**
   * The human-readable reason for a failed response, which the transport also puts after `"): "` in
   * `message`: the server's message from a valid error body, else the transport's text for an empty,
   * malformed or invalid body. Absent on errors not built from a response.
   */
  declare readonly detail?: string;

  constructor(
    public status: number,
    message: string,
    cause?: unknown,
    detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.cause = cause;
    if (detail !== undefined) {
      this.detail = detail;
    }
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
