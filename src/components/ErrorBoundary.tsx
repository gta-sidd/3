import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Smartphone, Tv } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CastPad] Uncaught runtime error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.location.href = url.toString();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-mono">
          <div className="max-w-md w-full bg-slate-900 border-2 border-red-500/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-4 text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-red-400 mb-2">CASTPAD CONTROLLER DIAGNOSTIC</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              An unexpected browser issue occurred while initializing the controller session.
            </p>
            {this.state.error && (
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-red-300 text-left overflow-x-auto mb-4 font-mono">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>RELOAD CONTROLLER</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <Tv className="w-4 h-4" />
                <span>SWITCH TO SCREEN</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
