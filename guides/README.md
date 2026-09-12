# Guide videos

The site is statically generated, so there is no upload form — "adding a video"
means putting the file here and referencing it from the guide's MDX.

```
public/guides/queen-charge-hybrid-th15/walkthrough.mp4
public/guides/queen-charge-hybrid-th15/walkthrough.webm   (optional)
public/guides/queen-charge-hybrid-th15/walkthrough.jpg    (poster)
```

Then in `content/guides/queen-charge-hybrid-th15.mdx`:

```mdx
<GuideVideo
  src="/guides/queen-charge-hybrid-th15/walkthrough.mp4"
  webm="/guides/queen-charge-hybrid-th15/walkthrough.webm"
  poster="/guides/queen-charge-hybrid-th15/walkthrough.jpg"
  caption="The funnel, at half speed"
/>
```

`src` is required; `webm`, `poster` and `caption` are optional. The component
checks the file exists at build time and renders a visible warning rather than
a broken player if it does not.

## Encoding

Target: watchable on a phone, small enough not to punish mobile data.

| Setting | Value |
|---|---|
| Container | MP4 (`.mp4`), `+faststart` |
| Video codec | H.264 High profile (universal) |
| Resolution | 1280×720, or 960×540 for a 30-second clip |
| Frame rate | keep the source's (30 or 60) — do not upscale |
| Quality | CRF 23–26 |
| Audio | AAC 96 kbps mono, or drop it entirely |

```bash
ffmpeg -i input.mp4 -vf "scale=1280:-2" -c:v libx264 -profile:v high -crf 24 -preset slow -c:a aac -b:a 96k -ac 1 -movflags +faststart walkthrough.mp4
```

`+faststart` matters: it moves the index to the front of the file so playback
starts before the whole thing has downloaded.

Optionally add a WebM/AV1 alongside it — roughly 30% smaller for modern
browsers, with the MP4 as the fallback:

```bash
ffmpeg -i input.mp4 -vf "scale=1280:-2" -c:v libsvtav1 -crf 34 -preset 6 -c:a libopus -b:a 96k walkthrough.webm
```

Gameplay is high-motion, so it compresses worse than talking-head footage.
Budget roughly 1.5–3 MB per 30 seconds at 720p. If a clip lands much above
that, drop to 960×540 before raising the CRF — resolution costs less perceived
quality than compression artefacts do on moving footage.

A poster frame is worth adding: the player shows it before playback, and
`preload="metadata"` means nothing but the poster and the header is fetched
until the reader presses play.
