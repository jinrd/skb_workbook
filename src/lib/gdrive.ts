import { google } from 'googleapis';
import { Readable } from 'node:stream';

/**
 * Google Drive API 서비스 계정 인증 클라이언트 얻기
 */
export function getGoogleDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive OAuth 2.0 credentials are not fully set in environment variables.');
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'https://developers.google.com/oauthplayground' // Redirect URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * 학생 업로드 파일명 표준 명명 규칙 생성 함수
 * 예: "[김민지]_[헤어커트A반]_20260730_143000_과제사진.jpg"
 */
export function buildFormattedFileName(params: {
  studentName: string;
  className: string;
  originalFileName: string;
}): string {
  const { studentName, className, originalFileName } = params;

  const safeStudent = studentName.replace(/[\\/:*?"<>|]/g, '');
  const safeClass = className.replace(/[\\/:*?"<>|]/g, '');
  const safeOriginal = originalFileName.replace(/[\\/:*?"<>|]/g, '_');

  const now = new Date();
  const dateStr = now.toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);

  return `[${safeStudent}]_[${safeClass}]_${dateStr}_${safeOriginal}`;
}

/**
 * Stream 기반 Google Drive 직접 스트리밍 파일 업로드
 */
export async function uploadStreamToGoogleDrive(params: {
  stream: Readable;
  fileName: string;
  mimeType: string;
}): Promise<{ fileId: string; fileName: string }> {
  const drive = getGoogleDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID environment variable is not defined.');
  }

  const response = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: [folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: params.stream,
    },
    supportsAllDrives: true,
    supportsTeamDrives: true,
    fields: 'id, name, size',
  });

  if (!response.data.id) {
    throw new Error('Failed to upload file to Google Drive.');
  }

  return {
    fileId: response.data.id,
    fileName: response.data.name || params.fileName,
  };
}

/**
 * Google Drive 파일 완전 삭제 (일일 Cleanup 작업용)
 */
export async function deleteFileFromGoogleDrive(fileId: string): Promise<boolean> {
  try {
    const drive = getGoogleDriveClient();
    await drive.files.delete({ fileId, supportsAllDrives: true, supportsTeamDrives: true });
    return true;
  } catch (error) {
    console.error(`Failed to delete Google Drive file (${fileId}):`, error);
    return false;
  }
}
