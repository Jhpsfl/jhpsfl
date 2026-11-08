import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// pay.nexavisiongroup.com serves only the Nexa-branded pay flow from this app.
const NEXA_PAY_HOST = 'pay.nexavisiongroup.com'
const NEXA_PAY_ALLOWED = /^\/(pay|l|api|_next|nexa-logo)/

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  '/account/dashboard(.*)',
  '/admin(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.hostname === NEXA_PAY_HOST && !NEXA_PAY_ALLOWED.test(req.nextUrl.pathname)) {
    return NextResponse.redirect('https://nexavisiongroup.com', 307)
  }
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
