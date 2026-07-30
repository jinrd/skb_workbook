import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function hashSecret(secret: string): Promise<string> {
  return await argon2.hash(secret);
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`🌱 Database Seeding 시작... (모드: ${isProduction ? '운영(Production)' : '개발(Development)'})`);

  // 1. 운영 및 개발 공통: 최초 관리자(원장님) 계정 생성/보장
  const adminLoginId = process.env.INITIAL_ADMIN_ID || 'admin';
  const adminRawPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin1234!';
  const adminPasswordHash = await hashSecret(adminRawPassword);

  const adminTeacher = await prisma.teacher.upsert({
    where: { loginId: adminLoginId },
    update: {}, // 기존 계정이 이미 존재하면 비밀번호를 임의로 덮어쓰지 않음
    create: {
      loginId: adminLoginId,
      name: '원장님 (최고 관리자)',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  console.log(`✅ 원장님(ADMIN) 관리자 계정 준비 완료: ID [ ${adminTeacher.loginId} ]`);

  // 2. 운영 환경인 경우 개발용 샘플 데이터 생성 중단 및 종료
  if (isProduction) {
    console.log('🔒 운영 환경(Production) 모드이므로 테스트용 샘플 반/수강생/실습 데이터 생성을 건너끕니다.');
    console.log('✨ 운영 준비가 성공적으로 완료되었습니다.');
    return;
  }

  // ==========================================
  // [개발/테스트 환경 전용] 테스트 샘플 데이터 주입
  // ==========================================
  console.log('🧪 개발 모드: 테스트용 강사, 반, 수강생, 실습 데이터 주입 중...');

  const teacherPasswordHash = await hashSecret('teacher1234!');
  const defaultStudentPinHash = await hashSecret('1234');

  const mainTeacher = await prisma.teacher.upsert({
    where: { loginId: 'teacher01' },
    update: { passwordHash: teacherPasswordHash },
    create: {
      loginId: 'teacher01',
      name: '김강사',
      passwordHash: teacherPasswordHash,
      role: 'TEACHER',
    },
  });

  // 3-1. 샘플 반 1: 헤어 커트 A반
  const classA = await prisma.class.upsert({
    where: { joinToken: 'HAIR-A-2026' },
    update: { teacherId: mainTeacher.id },
    create: {
      name: '헤어 커트 A반',
      description: '헤어 디자이너 국가자격증 정규 커트 과정 A반',
      joinToken: 'HAIR-A-2026',
      isActive: true,
      teacherId: mainTeacher.id,
      settingVersions: {
        create: {
          version: 1,
          name: '초기 설정',
          preEntryMinutes: 10,
          gracePeriodMinutes: 10,
          maxFilesPerSub: 5,
          maxFileSizeMB: 10,
          changedById: mainTeacher.id,
        },
      },
      practiceCategories: {
        create: [
          { name: '여성 숏커트', isActive: true },
          { name: '핑거웨이브', isActive: true },
          { name: '롤세팅', isActive: true },
        ],
      },
      schedules: {
        create: [
          {
            dayOfWeek: 4, // 목요일
            startTime: '14:00',
            endTime: '16:00',
            preEntryMinutes: 10,
            gracePeriodMinutes: 10,
          },
        ],
      },
    },
  });

  // 3-2. 샘플 반 2: 헤어 커트 B반
  const classB = await prisma.class.upsert({
    where: { joinToken: 'HAIR-B-2026' },
    update: { teacherId: mainTeacher.id },
    create: {
      name: '헤어 커트 B반',
      description: '실전 레이어드 및 보브 커트 응용 심화 B반',
      joinToken: 'HAIR-B-2026',
      isActive: true,
      teacherId: mainTeacher.id,
      settingVersions: {
        create: {
          version: 1,
          name: '초기 설정',
          preEntryMinutes: 10,
          gracePeriodMinutes: 10,
          maxFilesPerSub: 5,
          maxFileSizeMB: 10,
          changedById: mainTeacher.id,
        },
      },
      practiceCategories: {
        create: [
          { name: '레이어드 커트', isActive: true },
          { name: '보브 커트', isActive: true },
          { name: '원랭스 커트', isActive: true },
        ],
      },
      schedules: {
        create: [
          {
            dayOfWeek: 5, // 금요일
            startTime: '10:00',
            endTime: '12:00',
            preEntryMinutes: 10,
            gracePeriodMinutes: 10,
          },
        ],
      },
    },
  });

  // 3-3. 샘플 반 3: 업스타일 실기 C반
  const classC = await prisma.class.upsert({
    where: { joinToken: 'UPSTYLE-C-2026' },
    update: { teacherId: mainTeacher.id },
    create: {
      name: '업스타일 & 미용 C반',
      description: '웨딩 및 방송 업스타일 실기 응용 과정',
      joinToken: 'UPSTYLE-C-2026',
      isActive: true,
      teacherId: mainTeacher.id,
      settingVersions: {
        create: {
          version: 1,
          name: '초기 설정',
          preEntryMinutes: 10,
          gracePeriodMinutes: 10,
          maxFilesPerSub: 5,
          maxFileSizeMB: 10,
          changedById: mainTeacher.id,
        },
      },
      practiceCategories: {
        create: [
          { name: '브레이드 업스타일', isActive: true },
          { name: '웨딩 헤어 스타일링', isActive: true },
          { name: '퍼머넌트 웨이브', isActive: true },
        ],
      },
      schedules: {
        create: [
          {
            dayOfWeek: 3, // 수요일
            startTime: '15:00',
            endTime: '17:00',
            preEntryMinutes: 10,
            gracePeriodMinutes: 10,
          },
        ],
      },
    },
  });

  // 4. 각 반별 오늘 ClassSession 개설
  const classes = [classA, classB, classC];
  const sessionMap = new Map<string, string>();

  for (const cls of classes) {
    const session = await prisma.classSession.create({
      data: {
        classId: cls.id,
        status: 'OPEN',
        date: new Date(),
        scheduledStartTime: new Date(),
        scheduledEndTime: new Date(Date.now() + 2 * 3600 * 1000),
        actualAllowedStart: new Date(),
        actualAllowedEnd: new Date(Date.now() + 2 * 3600 * 1000),
        snapshotData: JSON.stringify({ className: cls.name, version: 1, preEntryMinutes: 10, gracePeriodMinutes: 10 }),
      },
    });
    sessionMap.set(cls.id, session.id);
  }

  // 5. 수강생 및 원본 Submission + DailyStudentReport 세트 생성
  const studentNames = [
    { name: '김민지', classId: classA.id },
    { name: '이서준', classId: classA.id },
    { name: '박도현', classId: classB.id },
    { name: '최수아', classId: classB.id },
    { name: '정예은', classId: classC.id },
    { name: '강현우', classId: classC.id },
  ];

  for (const st of studentNames) {
    const student = await prisma.student.create({
      data: {
        name: st.name,
        pinHash: defaultStudentPinHash,
        enrollments: {
          create: { classId: st.classId },
        },
      },
    });
    console.log(`  └ 수강생 생성: ${student.name} (PIN: 1234)`);

    const classSessionId = sessionMap.get(st.classId);
    if (classSessionId) {
      await prisma.submission.create({
        data: {
          classSessionId,
          studentId: student.id,
          categoryName: '원랭스 커트',
          durationMinutes: 60,
          content: '원랭스 커트 각도 45도 조절 연습 완료',
          submittedAt: new Date(),
          files: {
            create: [
              {
                googleFileId: '1sample_gdrive_hair_cut_01',
                fileName: `${student.name}_원랭스커트_완성작.jpg`,
                fileSize: 2450000,
              },
            ],
          },
        },
      });

      await prisma.submission.create({
        data: {
          classSessionId,
          studentId: student.id,
          categoryName: '와인딩 펌',
          durationMinutes: 60,
          content: '와인딩 텐션 및 로드 파지 연습',
          submittedAt: new Date(Date.now() - 20 * 60 * 1000),
          files: {
            create: [
              {
                googleFileId: '1sample_gdrive_hair_cut_02',
                fileName: `${student.name}_와인딩펌_과정.jpg`,
                fileSize: 3120000,
              },
            ],
          },
        },
      });
    }

    const nowObj = new Date();
    const getDateStr = (offsetDays: number) => {
      const d = new Date(nowObj);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().split('T')[0];
    };

    const sampleDates = [
      {
        offset: 0,
        duration: 120,
        count: 2,
        cats: { '원랭스 커트': 60, '와인딩 펌': 60 },
        memos: ['원랭스 커트 각도 45도 조절 연습 완료', '와인딩 텐션 및 로드 파지 연습'],
      },
      {
        offset: 1,
        duration: 90,
        count: 2,
        cats: { '여성 숏커트': 45, '핑거웨이브': 45 },
        memos: ['핑거웨이브 웨이브 간격 조절 연습', '숏커트 블렌딩 처리 향상'],
      },
    ];

    for (const sample of sampleDates) {
      const dateStr = getDateStr(sample.offset);
      await prisma.dailyStudentReport.upsert({
        where: {
          studentId_classId_date: {
            studentId: student.id,
            classId: st.classId,
            date: dateStr,
          },
        },
        update: {
          totalDurationMinutes: sample.duration,
          submissionCount: sample.count,
          categorySummary: JSON.stringify(sample.cats),
          memos: JSON.stringify(sample.memos),
        },
        create: {
          studentId: student.id,
          classId: st.classId,
          date: dateStr,
          totalDurationMinutes: sample.duration,
          submissionCount: sample.count,
          categorySummary: JSON.stringify(sample.cats),
          memos: JSON.stringify(sample.memos),
        },
      });
    }
  }

  console.log('✅ 개발 환경 테스트 샘플 주입 완료!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
