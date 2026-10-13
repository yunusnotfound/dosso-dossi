/** Read-only configuration check. Does not call iyzico or connect to the database. */
try {
  const { env } = await import('../src/config/env.js');
  const { paymentProvider } = await import('../src/features/wallet/payments/payment-provider-factory.js');
  console.info(`Ödeme sağlayıcı: ${env.PAYMENT_PROVIDER}`);
  if (env.PAYMENT_PROVIDER === 'dev') {
    paymentProvider.assertReady();
    console.info('Yerel simülasyon açık. Gerçek tahsilat yapılmaz; canlı ödeme hazırlığı doğrulanmış değildir.');
  } else {
    console.info(`iyzico ortamı: ${env.IYZICO_ENVIRONMENT}`);
    const missing = (['IYZICO_API_KEY', 'IYZICO_SECRET_KEY', 'IYZICO_CALLBACK_URL'] as const).filter((key) => !env[key]);
    if (missing.length) console.error(`Eksik ayarlar: ${missing.join(', ')}`);
    try {
      paymentProvider.assertReady();
      console.info('Sunucu yapılandırması geçerli. Anahtarların iyzico hesabında geçerli olduğu henüz doğrulanmadı.');
      console.info('Açılıştan önce: HTTPS callback erişimi, V3 webhook aktivasyonu, bakiye yükleme iş modeli onayı ve sandbox kabul işlemleri gerekli.');
    } catch {
      console.error('Ödeme kapalı: iyzico anahtarları, HTTPS callback veya ortam/zaman aşımı ayarı eksik ya da geçersiz.');
      process.exitCode = 1;
    }
  }
  console.info(`Güvenilen reverse proxy girdisi: ${env.TRUST_PROXY.length}. Anahtar değerleri yazdırılmadı.`);
} catch {
  console.error('Sunucu ortam yapılandırması geçersiz. .env.example ve docs/IYZICO.md koşullarını kontrol edin.');
  process.exitCode = 1;
}
