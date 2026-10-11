import { randomBytes } from 'node:crypto';
import { hashPassword, revokeAllSessions } from '../src/features/admin/admin-auth.service.js';
import { TEMP_PASSWORD_TTL_MS } from '../src/features/admin/temporary-password.js';
import { prisma } from '../src/lib/prisma.js';

/// İlk SUPER_ADMIN'i oluşturur. Şifre verilmezse rastgele üretilir ve
/// SADECE burada bir kez yazdırılır (DB'de yalnız argon2id hash'i durur).
///
///   npm run admin:create -- eposta@ornek.com "Ad Soyad" [sifre]
async function main(): Promise<void> {
  const [email, name, password] = process.argv.slice(2);
  if (!email) {
    console.error(
      'Kullanım: npm run admin:create -- <eposta> [ad] [sifre]',
    );
    process.exit(1);
  }

  const plain = password ?? randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(plain);
  const normalized = email.trim().toLowerCase();
  const credential = {
    passwordHash, mustChangePassword: !password,
    tempPasswordExpiresAt: password ? null : new Date(Date.now() + TEMP_PASSWORD_TTL_MS),
  };

  const admin = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.upsert({
    where: { email: normalized },
    update: { ...credential, role: 'SUPER_ADMIN', isActive: true },
    create: {
      email: normalized,
      name: name ?? '',
      ...credential,
      role: 'SUPER_ADMIN',
    },
    });
    await revokeAllSessions(tx, admin.id);
    return admin;
  });

  console.log(`SUPER_ADMIN hazır: ${admin.email}`);
  if (!password) {
    console.log(`Geçici şifre (bir daha gösterilmez): ${plain}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
