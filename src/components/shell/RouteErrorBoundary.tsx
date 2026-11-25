import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="page">
        <div className="mx-auto mt-10 max-w-lg rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Something went wrong on this page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The rest of the app still works. Reload to try again, or pick another page.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button className="mt-4" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}

/** Error boundary that resets whenever the route changes. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary key={location.pathname}>{children}</Boundary>;
}
