import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary for AgentM
 * Catches React rendering errors and shows fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[AgentM] Error caught by boundary:', error);
        console.error('[AgentM] Component stack:', errorInfo.componentStack);
    }

    handleReset = (): void => {
        // Clear storage on reset
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('agent-im.store.v1');
        }
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                        <div className="text-center space-y-4 p-8">
                            <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
                            <p className="text-gray-400 max-w-md">
                                {this.state.error?.message || 'Unknown error'}
                            </p>
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
                            >
                                Reset and Reload
                            </button>
                            <p className="text-xs text-gray-500">
                                This will clear your local data
                            </p>
                        </div>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
