import { NextResponse } from 'next/server';

const submissions: Array<{ email: string; userType: string; timestamp: string }> = [];

export async function POST(request: Request) {
  try {
    const { email, userType } = await request.json();

    // 验证邮箱格式
    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // 保存到内存
    submissions.push({
      email,
      userType,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ New waitlist signup:', { email, userType, total: submissions.length });

    // 检查 API Key
    const apiKey = process.env.RESEND_API_KEY;
    console.log('🔑 API Key exists:', !!apiKey);
    console.log('📧 FROM_EMAIL:', process.env.FROM_EMAIL || 'onboarding@resend.dev');

    if (apiKey) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);
        
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
        
        console.log('📤 Sending email to:', email);
        
        const result = await resend.emails.send({
          from: `Gradience <${fromEmail}>`,
          to: email,
          subject: "You're on the Gradience waitlist!",
          html: `<p>Thanks for joining! We'll notify you when early access is available (Q2 2026).</p>`,
        });
        
        console.log('✅ Email sent successfully:', result);
      } catch (emailError: any) {
        console.error('❌ Failed to send email:', emailError.message || emailError);
        // 继续执行，不阻断用户提交
      }
    } else {
      console.log('⚠️ No RESEND_API_KEY found, skipping email');
    }

    return NextResponse.json({ 
      success: true,
      message: "You're on the list! We'll notify you when early access is available."
    });

  } catch (error) {
    console.error('❌ Subscribe error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ count: submissions.length, submissions });
}
