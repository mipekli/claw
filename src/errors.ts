import { EXIT_CODES } from "./constants.js";

export class AppError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = EXIT_CODES.RUNTIME_ERROR) {
    super(message);
    this.exitCode = exitCode;
  }
}
