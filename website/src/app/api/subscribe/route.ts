import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const ALLOWED_USER_TYPES = new Set(['developer', 'gamer', 'protocol', 'investor']);
const EMAIL_SET_KEY = 'waitlist:emails';
const USER_PREFIX = 'waitlist:user:';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const email = normalizeEmail(payload?.email);
    const userType = normalizeUserType(payload?.userType);

    if (!email) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (!userType) {
      return NextResponse.json(
        { error: 'Please select a valid user type' },
        { status: 400 }
      );
    }

    // Check if email already exists using Redis set
    const exists = await kv.sismember(EMAIL_SET_KEY, email);
    if (exists) {
      return NextResponse.json({
        success: true,
        message: "You're already on the waitlist. We'll notify you when early access is available.",
      });
    }

    // Store email in set for deduplication
    await kv.sadd(EMAIL_SET_KEY, email);

    // Store user details as hash
    const userData = {
      email,
      userType,
      timestamp: new Date().toISOString(),
    };
    await kv.hset(`${USER_PREFIX}${email}`, userData);

    // Send welcome email
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);

        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

        await resend.emails.send({
          from: `Gradience <${fromEmail}>`,
          to: email,
          subject: "You're on the Gradience waitlist!",
          html: `<p>Thanks for joining! We'll notify you when early access is available (Q2 2026).</p>`,
        });
      } catch {
        // Email send failure should not block signup success.
      }
    }

    return NextResponse.json({
      success: true,
      message: "You're on the list! We'll notify you when early access is available."
    });

  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Count endpoint - public
  if (action === 'count') {
    try {
      const count = await kv.scard(EMAIL_SET_KEY);
      return NextResponse.json({ count });
    } catch {
      return NextResponse.json({ count: 0 });
    }
  }

  // List endpoint - requires admin key
  if (action === 'list') {
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      const emails = await kv.smembers(EMAIL_SET_KEY);
      type UserData = { email: string; userType?: string; timestamp?: string };
      const users = await Promise.all(
        emails.map(async (email) => {
          const userData = await kv.hgetall<UserData>(`${USER_PREFIX}${email}`);
          return userData || { email };
        })
      );

      // Sort by timestamp descending
      users.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      return NextResponse.json({
        count: users.length,
        users
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to fetch waitlist' },
        { status: 500 }
      );
    }
  }

  // Default: return count for backward compatibility
  try {
    const count = await kv.scard(EMAIL_SET_KEY);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!emailRegex.test(email)) return null;
  return email;
}

function normalizeUserType(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_USER_TYPES.has(normalized) ? normalized : null;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
