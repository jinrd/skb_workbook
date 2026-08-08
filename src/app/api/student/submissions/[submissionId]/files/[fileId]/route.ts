import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { getGoogleDriveClient } from "@/lib/gdrive";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string; fileId: string }> },
) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json({ error: "학생 세션이 만료되었습니다." }, { status: 401 });
    }

    const { submissionId, fileId } = await params;
    const file = await prisma.submissionFile.findFirst({
      where: {
        id: fileId,
        submissionId,
        isDeleted: false,
        submission: {
          studentId: session.studentId,
          classId: session.classId,
          classSessionId: session.classSessionId,
        },
      },
      select: { googleFileId: true, fileName: true, mimeType: true },
    });

    if (!file) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const drive = getGoogleDriveClient();
    const response = await drive.files.get(
      { fileId: file.googleFileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );

    return new Response(response.data as never, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Fetch student submission file error:", error);
    return NextResponse.json({ error: "첨부파일을 불러오지 못했습니다." }, { status: 500 });
  }
}
