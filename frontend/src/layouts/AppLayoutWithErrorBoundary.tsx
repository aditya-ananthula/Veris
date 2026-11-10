import { ErrorBoundary } from '../components/ErrorBoundary';
import { AppLayout } from './AppLayout';

export function AppLayoutWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <AppLayout />
    </ErrorBoundary>
  );
}