import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL 환경변수가 정의되지 않았습니다.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hashSecret(secret: string): Promise<string> {
  return await argon2.hash(secret);
}

/**
 * 계정 생성 CLI 스크립트
 * 사용법: npx tsx scripts/create-account.ts <loginId> <name> <password> <role: ADMIN|TEACHER>
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log('📌 사용법: node node_modules/tsx/dist/cli.mjs scripts/create-account.ts <loginId> <이름> <비밀번호> <ADMIN|TEACHER>');
    console.log('예시 1 (원장님): node node_modules/tsx/dist/cli.mjs scripts/create-account.ts director "원장님" "director1234!" ADMIN');
    console.log('예시 2 (강사님): node node_modules/tsx/dist/cli.mjs scripts/create-account.ts teacher_kim "김강사" "pass1234!" TEACHER');
    process.exit(1);
  }

  const [loginId, name, password, roleInput] = args;
  const role = roleInput.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'TEACHER';

  console.log(`⏳ [${role}] 계정 생성 중: ID(${loginId}), 이름(${name})...`);

  const passwordHash = await hashSecret(password);

  const teacher = await prisma.teacher.upsert({
    where: { loginId },
    update: {
      name,
      passwordHash,
      role,
    },
    create: {
      loginId,
      name,
      passwordHash,
      role,
    },
  });

  console.log(`✅ 계정이 성공적으로 생성/갱신되었습니다!`);
  console.log(`   - 아이디: ${teacher.loginId}`);
  console.log(`   - 이름: ${teacher.name}`);
  console.log(`   - 권한: ${teacher.role}`);
}

main()
  .catch((e) => {
    console.error('❌ 계정 생성 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
