import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server';


export async function middleware(request: NextRequest) {
  // Create an unmodified response first
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create the Supabase server-side client
  // We use the same environment variables as in the browser-side provider
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is updated, we update both the request and response
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, we remove it from both request and response
          request.cookies.delete(name);
          response = NextResponse.next({ request });
          response.cookies.set({ name: '', value: '', ...options });
        },
      },
    }
  );

  // Refresh session if expired - this ensures the user stays logged in
  const { data: { session } } = await supabase.auth.getSession();

  // Redirect logic:
  // 1. If user is NOT logged in and tries to access /dashboard, redirect to /login
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. If user IS logged in and tries to access /login, redirect to /dashboard
  if (session && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

// Ensure the middleware runs only on specified routes for performance
export const config = {
  matcher: [
    /*
     * Match protected routes only.
     * We REMOVED '/' from here so it remains public.
     */
    '/dashboard/:path*',
  ],
};
