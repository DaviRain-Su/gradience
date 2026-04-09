'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        padding: '40px',
                        textAlign: 'center',
                        background: '#F3F3F8',
                        minHeight: '100vh',
                    }}
                >
                    <h1 style={{ color: '#16161A', marginBottom: '16px' }}>Something went wrong</h1>
                    <p style={{ color: '#DC2626', marginBottom: '24px' }}>
                        {this.state.error?.message || 'Unknown error'}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '12px 24px',
                            background: '#16161A',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
