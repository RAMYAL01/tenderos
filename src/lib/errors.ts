/**
 * Standardized error types and API response helpers.
 *
 * All API routes use these helpers to ensure consistent error format:
 * {
 *   error: "Human-readable message",
 *   code: "MACHINE_READABLE_CODE",
 *   details?: { field: "..." }
 * }
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

// ── Error codes ────────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  UNAUTHORIZED:         "UNAUTHORIZED",
  FORBIDDEN:            "FORBIDDEN",
  NOT_FOUND:            "NOT_FOUND",
  CONFLICT:             "CONFLICT",
  VALIDATION_ERROR:     "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED:  "RATE_LIMIT_EXCEEDED",
  PAYMENT_REQUIRED:     "PAYMENT_REQUIRED",
  INTERNAL_ERROR:       "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE:  "SERVICE_UNAVAILABLE",
  PROCESSING_FAILED:    "PROCESSING_FAILED",
  AI_ERROR:             "AI_ERROR",
  STORAGE_ERROR:        "STORAGE_ERROR",
  QUOTA_EXCEEDED:       "QUOTA_EXCEEDED",
} as const;

// ── Custom error class ─────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, ERROR_CODES.UNAUTHORIZED, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, ERROR_CODES.FORBIDDEN, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, ERROR_CODES.NOT_FOUND, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 422, details);
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = "Usage quota exceeded. Please upgrade your plan.") {
    super(message, ERROR_CODES.QUOTA_EXCEEDED, 402);
  }
}

// ── API response helpers ───────────────────────────────────────────────────────

export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, { status, headers });
}

export function apiError(
  message: string,
  status = 500,
  code?: string,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: code ?? "INTERNAL_ERROR",
      ...(details ? { details } : {}),
    },
    { status }
  );
}

/**
 * Centralized API error handler.
 * Converts known error types to proper HTTP responses.
 * Logs unknown errors and returns a generic 500.
 */
export function handleApiError(
  err: unknown,
  context = "API"
): NextResponse {
  // Known app errors
  if (err instanceof AppError) {
    return apiError(err.message, err.status, err.code, err.details);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    return apiError(
      "Request validation failed",
      422,
      ERROR_CODES.VALIDATION_ERROR,
      { fieldErrors }
    );
  }

  // Prisma errors
  if (isPrismaError(err)) {
    if ((err as any).code === "P2002") {
      return apiError(
        "A record with this value already exists",
        409,
        ERROR_CODES.CONFLICT
      );
    }
    if ((err as any).code === "P2025") {
      return apiError("Record not found", 404, ERROR_CODES.NOT_FOUND);
    }
  }

  // Unknown error
  console.error(`[${context}] Unhandled error:`, err);
  return apiError(
    "An unexpected error occurred. Please try again.",
    500,
    ERROR_CODES.INTERNAL_ERROR
  );
}

function isPrismaError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as any).code === "string" &&
    (err as any).code.startsWith("P")
  );
}

/**
 * Wrapper for async API route handlers.
 * Catches all errors and returns standard error responses.
 *
 * Usage:
 *   export const POST = withErrorHandler(async (req) => {
 *     // your handler code
 *   });
 */
export function withErrorHandler(
  handler: (req: Request, ctx?: unknown) => Promise<NextResponse>
) {
  return async (req: Request, ctx?: unknown): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return handleApiError(err, req.url);
    }
  };
}
