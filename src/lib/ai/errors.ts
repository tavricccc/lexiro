export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}
export class AiRequestError extends Error {
  readonly retryAfterMs?: number;
  readonly retryable: boolean;
  readonly status?: number;
  readonly streamBroken: boolean;
  readonly code?: string;
  readonly debugMessage?: string;
  constructor(
    message: string,
    options: {
      retryable: boolean;
      retryAfterMs?: number;
      status?: number;
      streamBroken?: boolean;
      code?: string;
      debugMessage?: string;
    },
  ) {
    super(message);
    this.name = "AiRequestError";
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
    this.status = options.status;
    this.streamBroken = options.streamBroken ?? false;
    this.code = options.code;
    this.debugMessage = options.debugMessage;
  }
}

export class AiValidationError extends Error {
  readonly request: string;
  readonly response: string;
  readonly responseId?: string;

  constructor(
    message: string,
    request: string,
    response: string,
    responseId?: string,
  ) {
    super(message);
    this.name = "AiValidationError";
    this.request = request;
    this.response = response;
    this.responseId = responseId;
  }
}
