import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/features/admin/admin-auth.service.js';
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

  const admin = await prisma.adminUser.upsert({
    where: { email: normalized },
    update: { passwordHash, role: 'SUPER_ADMIN', isActive: true },
    create: {
      email: normalized,
      name: name ?? '',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
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
