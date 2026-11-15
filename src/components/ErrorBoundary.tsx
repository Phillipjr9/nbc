import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  /** Shown above the error so the user knows which area failed. */
  label?: string;
  onReset?: () => void;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * Last line of defence for the signed-in area.
 *
 * A single malformed profile (for example a Supabase row whose `profile_data`
 * has no transaction array) used to throw during render and unmount the whole
 * application — a white page, reported as "my transaction history disappeared".
 * Now the failure is contained, explained, and recoverable.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] Render failed in", this.props.label ?? "application", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="nbc-container py-12">
        <div className="mx-auto max-w-[640px] rounded-[6px] border border-[#f1b0b7] bg-[#fff5f5] p-6">
          <h1 className="text-[20px] font-bold text-nbc-navy">We could not display this page</h1>
          <p className="mt-2 text-[14px] leading-[22px] text-[#565656]">
            Part of your banking data could not be read on this device. Your transactions are safe — this is a
            display problem, not a data problem. Retry, or sign out and back in to reload your profile.
          </p>
          <p className="mt-3 rounded-[4px] bg-white/70 px-3 py-2 font-mono text-[12px] text-[#842029]">
            {error.message}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full bg-nbc-red px-5 py-2 text-[13.5px] font-semibold text-white transition hover:bg-nbc-red-dark"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-nbc-navy px-5 py-2 text-[13.5px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
            >
              Reload the page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
