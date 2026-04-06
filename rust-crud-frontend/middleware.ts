import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // ตรวจสอบ path ปัจจุบัน
  const path = request.nextUrl.pathname

  // กำหนด path ที่ไม่ต้อง login (public paths)
  const isPublicPath = path === '/login' || path === '/signup'

  // ดึง token จาก cookies (สมมติชื่อ 'auth_token' หรือเช็คเงื่อนไขอื่นตามระบบ auth ของคุณ)
  // ตอนนี้เอาแบบง่ายๆ คือถ้าไม่มี token ให้ถือว่ายังไม่ login
  const token = request.cookies.get('auth_token')?.value || ''

  // กรณี 1: ถ้าเข้าหน้า public (login/signup) แต่มี token แล้ว -> ดีดไปหน้า dashboard (/)
  if (isPublicPath && token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // กรณี 2: ถ้าเข้าหน้า protected (ไม่ใช่ public) และไม่มี token -> ดีดไปหน้า /login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // กรณีอื่นๆ ให้ทำงานต่อตามปกติ
  return NextResponse.next()
}

// กำหนด path ที่จะให้ middleware ทำงาน
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder contents
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
