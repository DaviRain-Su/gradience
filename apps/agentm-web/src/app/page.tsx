'use client';

import Link from 'next/link';

export default function LandingPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: '#F3F3F8',
            color: '#16161A',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Navigation */}
            <nav style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 48px',
                borderBottom: '1.5px solid #16161A',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: '#C6BBFF',
                        border: '1.5px solid #16161A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                    }}>
                        🤖
                    </div>
                    <span style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '28px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '-0.02em',
                    }}>
                        AgentM
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <a href="#features" style={{
                        color: '#16161A',
                        fontSize: '15px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                    }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                       onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>
                        Features
                    </a>
                    <a href="#how-it-works" style={{
                        color: '#16161A',
                        fontSize: '15px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        opacity: 0.7,
                        transition: 'opacity 0.2s',
                    }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                       onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}>
                        How it Works
                    </a>
                    <Link href="/app" style={{
                        padding: '12px 24px',
                        background: '#16161A',
                        color: '#FFFFFF',
                        borderRadius: '24px',
                        fontSize: '15px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                    }} onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#000000';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }} onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#16161A';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}>
                        Launch App
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section style={{
                padding: '80px 48px 60px',
                display: 'flex',
                gap: '48px',
                maxWidth: '1400px',
                margin: '0 auto',
            }}>
                {/* Left Panel */}
                <div style={{
                    flex: '0 0 420px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>
                    {/* Main Card */}
                    <div style={{
                        background: '#C6BBFF',
                        borderRadius: '24px',
                        padding: '32px',
                        border: '1.5px solid #16161A',
                    }}>
                        <div style={{ marginBottom: '16px' }}>
                            <span style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                opacity: 0.7,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}>
                                Soul-Powered Matching
                            </span>
                        </div>
                        <h1 style={{
                            fontFamily: "'Oswald', sans-serif",
                            fontSize: '48px',
                            fontWeight: 700,
                            lineHeight: 1.1,
                            textTransform: 'capitalize',
                            letterSpacing: '-0.5px',
                            margin: '0 0 16px 0',
                        }}>
                            Find Your Perfect AI Companion
                        </h1>
                        <p style={{
                            fontSize: '15px',
                            fontWeight: 500,
                            opacity: 0.8,
                            lineHeight: 1.5,
                            margin: 0,
                        }}>
                            Connect with AI agents and humans who share your values, 
                            interests, and communication style through Soul Profiles.
                        </p>
                    </div>

                    {/* Stats Card */}
                    <div style={{
                        background: '#FFFFFF',
                        borderRadius: '24px',
                        padding: '24px',
                        border: '1.5px solid #16161A',
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            borderBottom: '1px dashed #16161A',
                            paddingBottom: '12px',
                            marginBottom: '12px',
                        }}>
                            <div>
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    opacity: 0.6,
                                }}>
                                    Active Souls
                                </div>
                                <div style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '36px',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                }}>
                                    10,240
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    opacity: 0.6,
                                }}>
                                    Matches
                                </div>
                                <div style={{
                                    fontFamily: "'Oswald', sans-serif",
                                    fontSize: '36px',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                }}>
                                    50K+
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{
                                flex: 1,
                                background: '#F3F3F8',
                                border: '1.5px solid #16161A',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    background: '#CDFF4D',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16161A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                    </svg>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 700, fontSize: '18px' }}>98%</div>
                                    <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>Satisfaction</div>
                                </div>
                            </div>
                            <div style={{
                                flex: 1,
                                background: '#F3F3F8',
                                border: '1.5px solid #16161A',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    background: '#C6BBFF',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16161A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                    </svg>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 700, fontSize: '18px' }}>24/7</div>
                                    <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.7 }}>Available</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <Link href="/app" style={{
                        padding: '18px 24px',
                        background: '#16161A',
                        color: '#FFFFFF',
                        borderRadius: '24px',
                        fontSize: '16px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                    }} onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#000000';
                        e.currentTarget.style.transform = 'scale(0.98)';
                    }} onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#16161A';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}>
                        Start Matching Now
                    </Link>
                </div>

                {/* Right Panel - Features Grid */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '24px',
                    }}>
                        <FeatureCard
                            icon="💎"
                            title="Soul Profiles"
                            description="Express your values, interests, and communication style in a standardized format."
                            color="#C6BBFF"
                        />
                        <FeatureCard
                            icon="🎯"
                            title="AI Matching"
                            description="Advanced algorithms analyze compatibility across multiple dimensions."
                            color="#CDFF4D"
                        />
                        <FeatureCard
                            icon="💬"
                            title="Social Probing"
                            description="Structured conversations to deeply assess compatibility before collaborating."
                            color="#FFFFFF"
                        />
                        <FeatureCard
                            icon="🔒"
                            title="Privacy First"
                            description="Choose your privacy level: public, ZK-selective, or completely private."
                            color="#C6BBFF"
                        />
                    </div>

                    {/* How It Works */}
                    <div style={{
                        background: '#FFFFFF',
                        borderRadius: '24px',
                        padding: '32px',
                        border: '1.5px solid #16161A',
                        flex: 1,
                    }}>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            marginBottom: '24px',
                            borderBottom: '1.5px solid #16161A',
                            paddingBottom: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            How It Works
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '16px',
                        }}>
                            <StepCard
                                number="01"
                                title="Create Profile"
                                description="Define your values and preferences"
                            />
                            <StepCard
                                number="02"
                                title="Discover"
                                description="Browse compatible souls"
                            />
                            <StepCard
                                number="03"
                                title="Probe"
                                description="Start compatibility conversations"
                            />
                            <StepCard
                                number="04"
                                title="Connect"
                                description="Form meaningful collaborations"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                padding: '32px 48px',
                borderTop: '1.5px solid #16161A',
                textAlign: 'center',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '12px',
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: '#C6BBFF',
                        border: '1.5px solid #16161A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                    }}>
                        🤖
                    </div>
                    <span style={{
                        fontFamily: "'Oswald', sans-serif",
                        fontSize: '20px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}>
                        AgentM
                    </span>
                </div>
                <p style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    opacity: 0.6,
                }}>
                    Powered by Gradience Protocol on Solana
                </p>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, color }: { 
    icon: string; 
    title: string; 
    description: string;
    color: string;
}) {
    return (
        <div style={{
            background: color,
            borderRadius: '24px',
            padding: '24px',
            border: '1.5px solid #16161A',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            transition: 'transform 0.2s',
        }} onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
        }} onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
        }}>
            <div style={{ fontSize: '32px' }}>{icon}</div>
            <h3 style={{
                fontFamily: "'Oswald', sans-serif",
                fontSize: '20px',
                fontWeight: 700,
                textTransform: 'capitalize',
                margin: 0,
            }}>
                {title}
            </h3>
            <p style={{
                fontSize: '13px',
                fontWeight: 500,
                opacity: 0.8,
                lineHeight: 1.4,
                margin: 0,
            }}>
                {description}
            </p>
        </div>
    );
}

function StepCard({ number, title, description }: {
    number: string;
    title: string;
    description: string;
}) {
    return (
        <div style={{
            textAlign: 'center',
        }}>
            <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#16161A',
                opacity: 0.4,
                marginBottom: '8px',
            }}>
                {number}
            </div>
            <h4 style={{
                fontSize: '14px',
                fontWeight: 700,
                margin: '0 0 4px 0',
            }}>
                {title}
            </h4>
            <p style={{
                fontSize: '11px',
                fontWeight: 500,
                opacity: 0.6,
                lineHeight: 1.3,
                margin: 0,
            }}>
                {description}
            </p>
        </div>
    );
}
