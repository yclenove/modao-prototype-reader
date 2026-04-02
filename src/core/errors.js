export class ModaoReaderError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'ModaoReaderError';
    this.code = code;
    this.details = details;
  }
}

export function wrapError(error, fallbackCode = 'UNKNOWN_ERROR') {
  if (error instanceof ModaoReaderError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ModaoReaderError(fallbackCode, message);
}

export function errorToJson(error) {
  const wrapped = wrapError(error);
  return {
    code: wrapped.code,
    message: wrapped.message,
    details: wrapped.details,
  };
}
