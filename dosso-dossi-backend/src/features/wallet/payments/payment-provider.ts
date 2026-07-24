export interface CreatePaymentInput {
  intentId: string;
  userId: string;
  amount: number;
  savedCard?: boolean;
}

export interface CreatePaymentResult {
  providerRef: string;
  status: 'succeeded' | 'pending' | 'failed';
  /// 3DS akışı için yönlendirme adresi (iyzico adaptörü dolduracak)
  redirectUrl?: string;
}

/// Ödeme sağlayıcı soyutlaması. Gerçek sağlayıcı (iyzico) bu arayüzü
/// uygular; 'pending' dönerse müşteri redirectUrl'e yönlendirilir ve
/// sonuç /webhooks/payment/confirmation ile gelir.
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}
