import { AppContentSkeleton } from "./_components/app-content-skeleton";

/**
 * Content loading boundary. The shell (sidebar, top bar) stays mounted; this
 * only replaces the page body while the route's server render resolves.
 */
export default function AppLoading() {
  return <AppContentSkeleton />;
}
