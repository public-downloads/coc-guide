import Image from "next/image";
import { existsInPublic } from "@/lib/data/art";
import { MissingAsset } from "@/components/guides/MissingAsset";

/**
 * A screenshot in a guide:
 *
 *   <Figure src="/guides/queen-charge-hybrid-th15/funnel.webp"
 *           alt="Two small groups dropped on the corners"
 *           caption="The funnel, before the Queen goes in" />
 *
 * Same deal as `GuideVideo` — the file goes in `public/guides/<slug>/` and a
 * missing one is reported to the author rather than rendered as a broken box.
 * `aspect` is the box the image is fitted inside; it is never cropped, so a
 * portrait phone capture just letterboxes.
 */
export function Figure({
  src,
  alt,
  caption,
  aspect = "16 / 9",
}: {
  src: string;
  alt: string;
  caption?: string;
  aspect?: string;
}) {
  if (!existsInPublic(src)) {
    return <MissingAsset path={src} kind="Image" />;
  }

  return (
    <figure className="my-8">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-surface-raised"
        style={{ aspectRatio: aspect }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          // The prose column is max-w-2xl (672px); anything wider is wasted
          // bytes on the reader's phone.
          sizes="(max-width: 768px) 100vw, 672px"
          // The optimizer rejects SVG unless `dangerouslyAllowSVG` is set, and
          // there is nothing for it to compress in one anyway.
          unoptimized={src.endsWith(".svg")}
          className="object-contain"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs leading-relaxed text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
