export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly provider: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export enum ProviderErrorCode {
  AUTH_EXPIRED = "AUTH_EXPIRED",
  RATE_LIMITED = "RATE_LIMITED",
  NOT_FOUND = "NOT_FOUND",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INVALID_SYNC_TOKEN = "INVALID_SYNC_TOKEN",
  UNKNOWN = "UNKNOWN",
}
