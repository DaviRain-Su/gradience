/**
 * Simple Test View
 *
 * Test if styles are rendering correctly
 */

export function TestView() {
    return (
        <div
            style={{
                background: '#0a0a0a',
                minHeight: '100vh',
                padding: '40px',
                color: '#ffffff',
            }}
        >
            <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>Style Test</h1>

            {/* Test Card */}
            <div
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #222',
                    borderRadius: '12px',
                    padding: '24px',
                    maxWidth: '400px',
                }}
            >
                <h2
                    style={{
                        fontSize: '20px',
                        marginBottom: '12px',
                        color: '#ffffff',
                    }}
                >
                    Test Card
                </h2>
                <p
                    style={{
                        color: '#a0a0a0',
                        lineHeight: 1.6,
                    }}
                >
                    This is a test card to verify styles are working correctly. If you see this with dark background and
                    white text, it's working!
                </p>

                <button
                    style={{
                        marginTop: '16px',
                        padding: '10px 20px',
                        background: '#3b82f6',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                    }}
                >
                    Test Button
                </button>
            </div>

            {/* Color Palette Test */}
            <div style={{ marginTop: '40px' }}>
                <h2 style={{ marginBottom: '16px' }}>Color Palette</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {['#0a0a0a', '#111111', '#1a1a1a', '#222222', '#3b82f6', '#8b5cf6'].map((color) => (
                        <div
                            key={color}
                            style={{
                                width: '80px',
                                height: '80px',
                                background: color,
                                borderRadius: '8px',
                                border: '1px solid #333',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                color: '#fff',
                            }}
                        >
                            {color}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
