import { prisma } from '../src/lib/prisma';
import { hashSecret } from '../src/lib/auth';

async function main() {
  console.log('🌱 Database Seeding 시작...');

  // 1. 초기 비밀번호 생성 (argon2)
  const adminPasswordHash = await hashSecret('admin1234!');
  const teacherPasswordHash = await hashSecret('teacher1234!');
  const defaultStudentPinHash = await hashSecret('1234');

  // 2. 관리자 및 강사 계정 생성 (Upsert)
  const adminTeacher = await prisma.teacher.upsert({
    where: { loginId: 'admin' },
    update: { passwordHash: adminPasswordHash },
    create: {
      loginId: 'admin',
      name: '최고 관리자',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

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

  console.log('✅ 강사 계정 생성 완료:', {
    admin: adminTeacher.loginId,
    teacher: mainTeacher.loginId,
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
      // 1번째 원시 Submission + 파일
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

      // 2번째 원시 Submission + 파일
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

    // 샘플 일별 종합 기록 생성 (오늘, 어제, 2일 전, 7일 전)
    const nowObj = new Date();
    const getDateStr = (offsetDays: number) => {
      const d = new Date(nowObj);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().split('T')[0];
    };

    const sampleDates = [
      {
        offset: 0, // 오늘
        duration: 120,
        count: 2,
        cats: { '원랭스 커트': 60, '와인딩 펌': 60 },
        memos: ['원랭스 커트 각도 45도 조절 연습 완료', '와인딩 텐션 및 로드 파지 연습'],
      },
      {
        offset: 1, // 어제
        duration: 90,
        count: 2,
        cats: { '여성 숏커트': 45, '핑거웨이브': 45 },
        memos: ['핑거웨이브 웨이브 간격 조절 연습', '숏커트 블렌딩 처리 향상'],
      },
      {
        offset: 2, // 2일 전
        duration: 150,
        count: 3,
        cats: { '보브 커트': 60, '롤세팅': 90 },
        memos: ['롤세팅 열처리 시간 준수', '보브 커트 대칭 점검'],
      },
      {
        offset: 7, // 7일 전
        duration: 60,
        count: 1,
        cats: { '레이어드 커트': 60 },
        memos: ['레이어드 층 내기 기초 완성'],
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

  console.log('✅ 샘플 반 3개 및 오늘 제출 타임라인/파일 생성 완료!');
  console.log('🌱 Database Seeding 이 성공적으로 완료되었습니다.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
