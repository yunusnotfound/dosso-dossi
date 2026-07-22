// docs/API_CONTRACT.md hata sözleşmesi: { error: { code, message } }

export const ErrorCodes = {
  INVALID_OTP: 'INVALID_OTP',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_PROMO: 'INVALID_PROMO',
  BRANCH_CLOSED: 'BRANCH_CLOSED',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  NO_FREE_DRINK: 'NO_FREE_DRINK',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static invalidOtp(message = 'Kod geçersiz veya süresi dolmuş') {
    return new AppError(ErrorCodes.INVALID_OTP, 400, message);
  }
  static insufficientBalance(message = 'Bakiye yetersiz') {
    return new AppError(ErrorCodes.INSUFFICIENT_BALANCE, 400, message);
  }
  static invalidPromo(message = 'Kampanya kodu geçersiz') {
    return new AppError(ErrorCodes.INVALID_PROMO, 400, message);
  }
  static branchClosed(message = 'Şube şu anda kapalı') {
    return new AppError(ErrorCodes.BRANCH_CLOSED, 409, message);
  }
  static productUnavailable(message = 'Ürün şu anda mevcut değil') {
    return new AppError(ErrorCodes.PRODUCT_UNAVAILABLE, 409, message);
  }
  static noFreeDrink(message = 'Kullanılabilir ikram hakkı yok') {
    return new AppError(ErrorCodes.NO_FREE_DRINK, 400, message);
  }
  static unauthorized(message = 'Oturum gerekli') {
    return new AppError(ErrorCodes.UNAUTHORIZED, 401, message);
  }
  static notFound(message = 'Kayıt bulunamadı') {
    return new AppError(ErrorCodes.NOT_FOUND, 404, message);
  }
  static rateLimited(message = 'Çok fazla deneme, lütfen bekleyin') {
    return new AppError(ErrorCodes.RATE_LIMITED, 429, message);
  }
}
