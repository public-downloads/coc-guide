/**
 * What a guide renders in place of an asset that is not on disk. Visible
 * rather than silent: the author is the one who sees the page first, and a
 * quiet fallback is how a guide ships with a dead screenshot.
 */
export function MissingAsset({ path, kind }: { path: string; kind: string }) {
  return (
    <aside className="my-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
      <p className="font-medium">{kind} not found</p>
      <p className="mt-1 leading-relaxed">
        Expected a file at <code className="font-mono text-xs">public{path}</code>
        . Drop it there and it will appear here.
      </p>
    </aside>
  );
}
