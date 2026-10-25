export type ErrorCode = 'VALIDATION'|'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'EXPIRED'|'CONFLICT'|'CAPACITY'|'RATE_LIMIT'|'INTEGRITY'|'RANGE'|'STORAGE'|'UNAVAILABLE';
export interface ApiError { error: { code: ErrorCode; message: string; retryable: boolean } }
