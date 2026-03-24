import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-red-500 p-10 font-mono text-xs overflow-auto">
          <h1 className="text-xl font-bold mb-4">React App Crashed</h1>
          <p className="mb-4">An error occurred during rendering.</p>
          <pre className="bg-gray-900 p-4 rounded whitespace-pre-wrap break-words">
            {this.state.error?.stack || this.state.error?.message || 'Unknown error'}
          </pre>
          <button 
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded font-bold"
            onClick={() => window.location.reload()}
          >
            Reload Default State
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
