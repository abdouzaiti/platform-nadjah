import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-red-500 font-mono text-sm bg-red-50 min-h-screen">
          <h1 className="text-2xl font-bold mb-4 animate-bounce">A Wild React Error Appeared!</h1>
          <p className="bg-white p-4 rounded shadow-lg overflow-x-auto">
            {this.state.error?.toString()}
          </p>
          {this.state.error?.stack && (
            <pre className="mt-4 p-4 bg-white rounded shadow-lg overflow-x-auto text-xs">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
