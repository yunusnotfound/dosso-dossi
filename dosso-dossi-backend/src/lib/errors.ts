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
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_QR: 'INVALID_QR',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  VOID_NOT_ALLOWED: 'VOID_NOT_ALLOWED',
  PAYMENT_NOT_PENDING: 'PAYMENT_NOT_PENDING',
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
  static invalidSignature(message = 'İmza doğrulanamadı') {
    return new AppError(ErrorCodes.INVALID_SIGNATURE, 401, message);
  }
  static invalidQr(message = 'Kod geçersiz veya süresi dolmuş') {
    return new AppError(ErrorCodes.INVALID_QR, 400, message);
  }
  static invalidStatusTransition(message = 'Geçersiz sipariş durumu geçişi') {
    return new AppError(ErrorCodes.INVALID_STATUS_TRANSITION, 409, message);
  }
  static voidNotAllowed(message = 'İptal penceresi kapandı veya işlem uygun değil') {
    return new AppError(ErrorCodes.VOID_NOT_ALLOWED, 409, message);
  }
  static paymentNotPending(message = 'Ödeme beklemede değil') {
    return new AppError(ErrorCodes.PAYMENT_NOT_PENDING, 409, message);
  }
}
