import argon2 from 'argon2';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

// 쿠키 이름 상수
export const TEACHER_SESSION_COOKIE = 'teacher_session_token';
export const STUDENT_SESSION_COOKIE = 'student_session_token';

const SESSION_SECRET = process.env.SESSION_SECRET || 'skb-workbook-secure-cookie-secret-key-2026';

// HMAC-SHA256 서명 생성
function generateHmac(payloadStr: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('hex');
}

// 비밀번호 및 PIN 해싱
export async function hashSecret(secret: string): Promise<string> {
  return await argon2.hash(secret);
}

// 비밀번호 및 PIN 검증
export async function verifySecret(hash: string, plainText: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch (error) {
    console.error('Secret verification failed:', error);
    return false;
  }
}

// 강사 세션 데이터 타입
export interface TeacherSessionData {
  teacherId: string;
  loginId: string;
  name: string;
  role: 'ADMIN' | 'TEACHER';
}

// 학생 세션 데이터 타입
export interface StudentSessionData {
  studentSessionId: string;
  studentId: string;
  studentName: string;
  classSessionId: string;
  classId: string;
  className: string;
}

// HMAC-SHA256 서명된 토큰 인코딩
export function encryptPayload<T>(payload: T): string {
  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr).toString('base64url');
  const signature = generateHmac(base64Payload);
  return `${base64Payload}.${signature}`;
}

// HMAC-SHA256 서명 검증 및 디코딩
export function decryptPayload<T>(encoded: string): T | null {
  try {
    if (!encoded || !encoded.includes('.')) return null;

    const parts = encoded.split('.');
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    const expectedSignature = generateHmac(base64Payload);

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn('Cookie signature verification failed! Tampering detected.');
      return null;
    }

    const jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('Session decryption error:', error);
    return null;
  }
}

// 강사 세션 쿠키 설정
export async function setTeacherSessionCookie(data: TeacherSessionData) {
  const cookieStore = await cookies();
  const token = encryptPayload(data);
  
  cookieStore.set(TEACHER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12시간
  });
}

// 강사 세션 쿠키 가져오기 (서명 검증 적용)
export async function getTeacherSession(): Promise<TeacherSessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(TEACHER_SESSION_COOKIE);
  if (!cookie?.value) return null;
  return decryptPayload<TeacherSessionData>(cookie.value);
}

// 강사 세션 쿠키 삭제
export async function clearTeacherSession() {
  const cookieStore = await cookies();
  cookieStore.delete(TEACHER_SESSION_COOKIE);
}

// 학생 세션 쿠키 설정 (수업 전용 단기 세션)
export async function setStudentSessionCookie(data: StudentSessionData, expiresAt: Date) {
  const cookieStore = await cookies();
  const token = encryptPayload(data);
  
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  
  cookieStore.set(STUDENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

// 학생 세션 쿠키 가져오기 (서명 검증 적용)
export async function getStudentSession(): Promise<StudentSessionData | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(STUDENT_SESSION_COOKIE);
  if (!cookie?.value) return null;
  return decryptPayload<StudentSessionData>(cookie.value);
}

// 학생 세션 쿠키 삭제
export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(STUDENT_SESSION_COOKIE);
}
