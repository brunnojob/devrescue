import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext } from "@tanstack/react-router";
import { PreferencesProvider } from "@/lib/preferences";
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: () => (
    <main className="p-8">
      <h1>Page not found</h1>
      <Link to="/">Go home</Link>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="p-8">
      <h1>This page did not load</h1>
      <button onClick={reset}>Try again</button>
    </main>
  ),
});
function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <PreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </PreferencesProvider>
  );
}
