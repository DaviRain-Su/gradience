import { NextResponse } from 'next/server';

const submissions: Array<{ email: string; userType: string; timestamp: string }> = [];
const ALLOWED_USER_TYPES = new Set(['developer', 'gamer', 'protocol', 'investor']);

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

    const exists = submissions.some((entry) => entry.email === email);
    if (exists) {
      return NextResponse.json({
        success: true,
        message: "You're already on the waitlist. We'll notify you when early access is available.",
      });
    }

    submissions.push({
      email,
      userType,
      timestamp: new Date().toISOString(),
    });

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

export async function GET() {
  return NextResponse.json({ count: submissions.length });
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
