# Kettlebell Circuit Timer

A browser extension that runs a rounds/work/rest timer over an Instagram
carousel workout post, automatically advancing the carousel between
exercises and navigating back to the first slide at the start of each new
round.

It runs entirely inside the Instagram tab it's injected into — there's no
server, no scraping, no auth workaround. It just drives the page you're
already logged into: click the carousel's own Next control, read the URL,
navigate.

## How it works

1. Open a workout post's **permalink** page directly (see URL examples
   below) — not a post opened as a modal from the home feed.
2. A HUD appears in the top-right corner with editable Rounds / Work
   seconds / Rest seconds / Exercise count, pre-filled with defaults.
3. Click **Start**. Each work interval clicks the carousel's Next arrow
   when it ends. When a round's last exercise finishes, the timer beeps,
   redirects back to the first slide, and rests there before starting the
   next round.
4. **Space** pauses/resumes. **Esc** stops and resets to the setup screen.

## Instagram post URL examples

The extension's content script only matches the direct permalink form:

```
https://www.instagram.com/p/<post-id>/
https://www.instagram.com/p/<post-id>/?img_index=1
```

For example, given the post `https://www.instagram.com/p/Dbvcgimj9Bu/`:

```
https://www.instagram.com/p/Dbvcgimj9Bu/
https://www.instagram.com/p/Dbvcgimj9Bu/?img_index=1
https://www.instagram.com/p/Dbvcgimj9Bu/?img_index=3
```

Reels permalinks work the same way:

```
https://www.instagram.com/reel/<reel-id>/
```

**Not supported:** a post opened as a modal overlay from the home feed
(URL still shows the feed, e.g. `https://www.instagram.com/`) — open the
post directly, or use the `/kettlebell <url>` Claude Code skill, which
always launches the direct permalink.

## Install (unpacked)

1. Open `brave://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Navigate to a permalink URL from the examples above — the HUD appears
   on its own via the content script.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest; content script matches `instagram.com/p/*` |
| `content.js` | State machine, timer, storage, carousel-advance logic |
| `selectors.js` | Isolated DOM lookups for the carousel's Next control |
| `overlay.js` / `overlay.css` | Shadow-DOM HUD (idle + active states) |
| `background.js` | Grants content scripts access to `chrome.storage.session` |

## Known limitations

- Selector drift: Instagram's class names churn across releases; if the
  Next button stops responding, check `selectors.js` first.
- `chrome.storage.session` isn't tab-scoped — running the timer in two
  tabs on the same post at once will fight over the same state.
