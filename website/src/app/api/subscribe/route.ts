import { NextResponse } from 'next/server';

// 简单的订阅 API，暂时不依赖 Resend
// 后续可以接入 Resend、Mailchimp 或其他邮件服务

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

    // 保存到内存（生产环境应该保存到数据库或邮件服务）
    submissions.push({
      email,
      userType,
      timestamp: new Date().toISOString(),
    });

    // 打印到服务器日志（你可以在这里发送邮件）
    console.log('New waitlist signup:', { email, userType, total: submissions.length });

    // 如果有 Resend API Key，发送确认邮件
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(apiKey);
        
        // 给用户发送确认邮件
        await resend.emails.send({
          from: 'Gradience <hello@gradiences.xyz>',
          to: email,
          subject: "You're on the Gradience waitlist!",
          html: `<p>Thanks for joining! We'll notify you when early access is available (Q2 2026).</p>`,
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "You're on the list! We'll notify you when early access is available."
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

// 可选：GET 接口查看所有订阅（需要认证）
export async function GET() {
  // 生产环境应该添加认证
  return NextResponse.json({ count: submissions.length, submissions });
}
