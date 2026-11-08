import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cookieName,cookieOptions,loginDestinationCookie,safeRedirectPath } from '@/lib/auth';
import { bindingCookie,finishLogin } from '@/lib/identity/oidc';
import { appOrigin } from '@/lib/ops/config';
export async function GET(req:Request){const origin=appOrigin();const requestCookies=await cookies();try{const url=new URL('/api/auth/callback',origin);url.search=new URL(req.url).search;const token=await finishLogin(url,requestCookies.get(bindingCookie)?.value);const destination=safeRedirectPath(requestCookies.get(loginDestinationCookie)?.value);const response=NextResponse.redirect(new URL(destination,origin),303);response.cookies.set(cookieName,token,cookieOptions());response.cookies.set(bindingCookie,'',{...cookieOptions(),maxAge:0});response.cookies.set(loginDestinationCookie,'',{...cookieOptions(),maxAge:0});return response;}catch{const response=NextResponse.redirect(new URL('/login?error=oidc',origin),303);response.cookies.set(bindingCookie,'',{...cookieOptions(),maxAge:0});response.cookies.set(loginDestinationCookie,'',{...cookieOptions(),maxAge:0});return response;}}
