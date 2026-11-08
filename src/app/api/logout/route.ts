import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cookieName,validOrigin,revokeSession,cookieOptions } from '@/lib/auth';
import { appOrigin } from '@/lib/ops/config';
export async function POST(req:Request){if(!validOrigin(req))return new Response('Forbidden',{status:403});await revokeSession((await cookies()).get(cookieName)?.value);const response=NextResponse.redirect(new URL('/login',appOrigin()),303);response.cookies.set(cookieName,'',{...cookieOptions(),maxAge:0});return response;}
