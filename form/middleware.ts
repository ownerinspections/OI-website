import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Only process Server Actions (POST requests with form data)
  if (request.method === 'POST' && 
      request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    
    // Create new headers with corrected values
    const newHeaders = new Headers(request.headers);
    
    // Force the correct host headers for Server Actions
    newHeaders.set('host', 'form.owner-inspections.com.au');
    newHeaders.set('x-forwarded-host', 'form.owner-inspections.com.au');
    
    // Create a new request with corrected headers
    const newRequest = new Request(request.url, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
    });
    
    return NextResponse.next({
      request: newRequest,
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes that might have Server Actions
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
