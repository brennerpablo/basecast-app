import { RunNotebook } from "./_components/run-notebook";

/** One model run (a mart build) laid out as an audited notebook: parameters, each mart's checks and output, the log. */
export default async function ModelRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunNotebook runId={runId} />;
}
