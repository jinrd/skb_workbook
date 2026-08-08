import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/auth";
import { getSeoulNow } from "@/lib/timezone";
import {
  buildFormattedFileName,
  deleteFileFromGoogleDrive,
  uploadStreamToGoogleDrive,
} from "@/lib/gdrive";
import { checkClassAccess } from "@/lib/accessControl";

export async function POST(request: Request) {
  try {
    const session = await getStudentSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "로그인 세션이 만료되었습니다. QR 코드로 다시 입장해 주세요.",
        },
        { status: 401 },
      );
    }

    const now = getSeoulNow();

    const dbStudentSession = await prisma.studentSession.findFirst({
      where: {
        id: session.studentSessionId,
        studentId: session.studentId,
        classSessionId: session.classSessionId,
        isValid: true,
        expiresAt: { gte: now },
      },
    });

    if (!dbStudentSession) {
      return NextResponse.json(
        {
          error:
            "유효하지 않거나 만료된 학생 세션입니다. QR 코드로 다시 로그인해 주세요.",
        },
        { status: 401 },
      );
    }

    const accessCheck = await checkClassAccess({
      classId: session.classId,
    });

    if (!accessCheck.isAllowed) {
      return NextResponse.json(
        {
          error:
            accessCheck.reason ||
            "현재 수업이 마감되어 결과를 제출할 수 없습니다.",
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const practiceGoalId = String(formData.get("practiceGoalId") ?? "").trim();

    const durationSeconds = Number(formData.get("durationSeconds"));

    const memo = String(formData.get("memo") ?? "").trim();

    const fileEntries = (formData.getAll("files") as File[]).filter(
      (file) => file && file.name,
    );

    if (!practiceGoalId) {
      return NextResponse.json(
        { error: "연습 목표를 선택해 주세요." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      return NextResponse.json(
        { error: "연습 시간을 1초 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    const [classSession, practiceGoal] = await Promise.all([
      prisma.classSession.findFirst({
        where: {
          id: session.classSessionId,
          classId: session.classId,
        },
        include: {
          class: {
            include: {
              settingVersions: {
                orderBy: { version: "desc" },
                take: 1,
              },
            },
          },
        },
      }),

      prisma.practiceGoal.findFirst({
        where: {
          id: practiceGoalId,
          classId: session.classId,
          isActive: true,
        },
      }),
    ]);

    if (!classSession) {
      return NextResponse.json(
        { error: "현재 수업 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (!practiceGoal) {
      return NextResponse.json(
        { error: "선택한 연습 목표를 사용할 수 없습니다." },
        { status: 400 },
      );
    }

    const latestSetting = classSession.class.settingVersions[0];

    const maxFiles = latestSetting?.maxFilesPerSub ?? 5;
    const maxFileSizeMB = latestSetting?.maxFileSizeMB ?? 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

    if (fileEntries.length > maxFiles) {
      return NextResponse.json(
        {
          error: `첨부파일은 최대 ${maxFiles}개까지 업로드할 수 있습니다.`,
        },
        { status: 400 },
      );
    }

    for (const file of fileEntries) {
      if (file.size > maxFileSizeBytes) {
        return NextResponse.json(
          {
            error: `'${file.name}' 파일이 ${maxFileSizeMB}MB 제한을 초과했습니다.`,
          },
          { status: 400 },
        );
      }
    }

    const submission = await prisma.submission.create({
      data: {
        classId: session.classId,
        classSessionId: session.classSessionId,
        studentId: session.studentId,
        practiceGoalId: practiceGoal.id,
        goalName: practiceGoal.name,
        durationSeconds,
        memo: memo || null,
        submittedAt: now,
      },
    });

    const uploadedFileIds: string[] = [];
    let savedFilesCount = 0;

    try {
      for (const file of fileEntries) {
        const buffer = Buffer.from(await file.arrayBuffer());

        const formattedFileName = buildFormattedFileName({
          studentName: session.studentName,
          className: session.className,
          originalFileName: file.name,
        });

        const { Readable } = await import("node:stream");

        const driveResult = await uploadStreamToGoogleDrive({
          // Buffer를 여러 바이트 청크로 해석하지 않고 하나의 업로드 본문으로 전달합니다.
          stream: Readable.from([buffer]),
          fileName: formattedFileName,
          mimeType: file.type || "application/octet-stream",
        });

        uploadedFileIds.push(driveResult.fileId);

        await prisma.submissionFile.create({
          data: {
            submissionId: submission.id,
            googleFileId: driveResult.fileId,
            fileName: formattedFileName,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
          },
        });

        savedFilesCount += 1;
      }
    } catch (uploadError) {
      await Promise.allSettled(
        uploadedFileIds.map((fileId) => deleteFileFromGoogleDrive(fileId)),
      );

      await prisma.submission.delete({
        where: { id: submission.id },
      });

      const uploadErrorRecord =
        typeof uploadError === "object" && uploadError !== null
          ? uploadError as { message?: string; code?: number; response?: { data?: unknown } }
          : null;
      console.error("Google Drive upload failed:", {
        message: uploadError instanceof Error ? uploadError.message : String(uploadError),
        code: uploadErrorRecord?.code,
        response: uploadErrorRecord?.response?.data,
      });

      return NextResponse.json(
        {
          error: "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "연습 결과가 성공적으로 제출되었습니다.",
      submissionId: submission.id,
      filesCount: savedFilesCount,
    });
  } catch (error) {
    console.error("Student submission error:", error);

    return NextResponse.json(
      {
        error: "제출물을 처리하는 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
