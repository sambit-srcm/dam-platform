export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(400, 'validation_error', message, cause);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access Denied') {
    super(403, 'forbidden', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(409, 'conflict', message, cause);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, 'too_many_requests', message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(503, 'service_unavailable', message);
  }
}
