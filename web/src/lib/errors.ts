export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: unknown) {
    super(message ?? code);
  }
}
export const badRequest = (code: string, msg?: string, details?: unknown) => new ApiError(400, code, msg, details);
export const unauthorized = () => new ApiError(401, "unauthorized", "Требуется вход");
export const forbidden = () => new ApiError(403, "forbidden", "Недостаточно прав");
export const notFound = (what = "not_found") => new ApiError(404, what, "Не найдено");
export const conflict = (code: string, msg?: string) => new ApiError(409, code, msg);
