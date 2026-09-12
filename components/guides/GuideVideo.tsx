import { existsInPublic } from "@/lib/data/art";
import { withBasePath } from "@/lib/site";
import { MissingAsset } from "@/components/guides/MissingAsset";

/**
 * A replay embedded in a guide:
 *
 *   <GuideVideo src="/guides/queen-charge-hybrid-th15/walkthrough.mp4"
 *               poster="/guides/queen-charge-hybrid-th15/walkthrough.jpg"
 *               caption="The funnel, at 0.5x" />
 *
 * There is no upload endpoint — the site is statically generated, so "adding a
 * video" means dropping the file into `public/guides/<slug>/` and referencing
 * it. This is a server component so a missing file is caught at build time
 * rather than showing the reader a broken player.
 */
export function GuideVideo({
  src,
  webm,
  poster,
  caption,
}: {
  src: string;
  webm?: string;
  poster?: string;
  caption?: string;
}) {
  const missing = [src, webm, poster].filter(
    (file): file is string => Boolean(file) && !existsInPublic(file!),
  );

  if (missing.includes(src)) {
    return <MissingAsset path={src} kind="Video" />;
  }

  return (
    <figure className="my-8">
      <video
        controls
        playsInline
        // Only fetch the first frames until the reader presses play — a guide
        // page can carry several of these.
        preload="metadata"
        // `existsInPublic` checks the path as written; the browser needs it
        // prefixed when Pages serves from a subdirectory.
        poster={
          poster && !missing.includes(poster) ? withBasePath(poster) : undefined
        }
        className="w-full rounded-xl border border-border bg-black"
      >
        {webm && !missing.includes(webm) && (
          <source src={withBasePath(webm)} type="video/webm" />
        )}
        <source src={withBasePath(src)} type={mimeFor(src)} />
        Your browser cannot play this video.
      </video>
      {caption && (
        <figcaption className="mt-2 text-xs leading-relaxed text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function mimeFor(file: string): string {
  if (file.endsWith(".webm")) return "video/webm";
  if (file.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}
