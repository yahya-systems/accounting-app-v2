// src/middleware/error/app-error.ts
export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AppError";
  }
}
