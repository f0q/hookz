# Hookz — Import File Format Specification

This document defines the exact format that any external app (the "hook generator") must produce
so that **Hookz** can import texts automatically via the **📥 Import Texts** button.

---

## File Format

| Property | Value |
|----------|-------|
| Format | JSON |
| Extension | `.json` (recommended: `hooks_export.json`) |
| Encoding | UTF-8 |
| Line endings | Any (LF or CRLF) |

---

## Supported Structures

Hookz accepts **two interchangeable formats**.

### Format 1 — Flat array (preferred)

```json
[
  {
    "filename": "hook_01.mp4",
    "text": "This is the overlay text for hook 1"
  },
  {
    "filename": "hook_02.mp4",
    "text": "Second hook text\nCan be multiline"
  }
]
```

### Format 2 — Wrapper object

```json
{
  "hooks": [
    {
      "filename": "hook_01.mp4",
      "text": "This is the overlay text for hook 1"
    },
    {
      "filename": "hook_02.mp4",
      "text": "Second hook text\nCan be multiline"
    }
  ]
}
```

The wrapper object may contain any additional top-level fields (`project`, `created_at`, `version`, etc.)
— Hookz only reads the `hooks` array.

---

## Hook Entry Fields

### Required

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | The overlay text to burn onto the video. Required. Can be empty string `""` but should not be. |

### Optional (but strongly recommended)

| Field | Type | Aliases accepted | Description |
|-------|------|-----------------|-------------|
| `filename` | string | `file`, `video_filename` | Basename of the corresponding video file, e.g. `hook_01.mp4`. Used for **smart matching** — if a hook video with this filename is already loaded in Hookz, the text is applied to it regardless of list order. If absent, texts are matched **positionally** (index 0 → first hook, index 1 → second hook, etc.). |

### Optional extras (preserved by Hookz but not currently used by UI)

These fields are safe to include — Hookz ignores them gracefully:

| Field | Type | Example |
|-------|------|---------|
| `hook_id` | string / int | `"h_001"` |
| `duration_sec` | number | `8` |
| `tags` | array of strings | `["product", "emotion"]` |
| `score` | number | `0.87` |
| `notes` | string | `"AI-generated, check before use"` |

---

## Text Content Rules

| Rule | Detail |
|------|--------|
| Max length | 500 characters per hook |
| Newlines | Use `\n` in JSON to produce line breaks in the video overlay |
| Special characters | All UTF-8 characters supported (emoji, Cyrillic, Arabic, etc.) |
| Quotes / apostrophes | No escaping needed — handled automatically by Hookz |
| Leading/trailing whitespace | Preserved as-is |

### Example with multiline text

```json
{
  "filename": "hook_emotion.mp4",
  "text": "Feeling stuck?\nThis changes everything."
}
```

---

## Matching Logic (how Hookz applies imported texts)

When the user clicks **Import Texts** and selects the file, Hookz does the following:

1. **Filename match** — for each imported entry that has a `filename`, Hookz looks for a
   loaded hook video whose basename exactly matches. If found, that text is applied to it.

2. **Positional fallback** — for entries without `filename`, or if no filename match is found,
   texts are applied in order: entry [0] first hook, [1] second hook, etc.

3. **More texts than hooks** — if the file contains more entries than loaded hooks, Hookz
   creates **new empty hook slots** with the text pre-filled. The user then selects the
   video file for each new slot manually.

4. **Fewer texts than hooks** — already-loaded hooks without a matching entry keep their
   existing text unchanged.

---

## Minimal Valid Export Example

```json
[
  { "filename": "hook_01.mp4", "text": "Stop scrolling. You need to see this." },
  { "filename": "hook_02.mp4", "text": "The secret nobody tells you about." },
  { "filename": "hook_03.mp4", "text": "I tried this for 30 days.\nHere's what happened." }
]
```

---

## Full Export Example (with metadata)

```json
{
  "project": "Spring Campaign 2025",
  "created_at": "2025-04-20T01:30:00Z",
  "version": "1.0",
  "hooks": [
    {
      "hook_id": "h_001",
      "filename": "hook_emotion.mp4",
      "text": "Feeling stuck?\nThis changes everything.",
      "duration_sec": 8,
      "tags": ["emotion", "curiosity"],
      "score": 0.92
    },
    {
      "hook_id": "h_002",
      "filename": "hook_product.mp4",
      "text": "The only tool you'll ever need.",
      "duration_sec": 6,
      "tags": ["product"],
      "score": 0.85
    },
    {
      "hook_id": "h_003",
      "filename": "hook_story.mp4",
      "text": "I was broke 2 years ago.\nNow I do this full-time.",
      "duration_sec": 10,
      "tags": ["story", "transformation"],
      "score": 0.78
    }
  ]
}
```

---

## Validation Rules (what the generator app must guarantee)

- [ ] Output is valid JSON (parseable by JSON.parse)
- [ ] Root is either an array or an object with a `hooks` array
- [ ] Each entry has at minimum the `text` field as a string
- [ ] `filename` value is the **basename only** (no full path), e.g. `hook_01.mp4` not `/Users/jams/videos/hook_01.mp4`
- [ ] `text` length does not exceed 500 characters
- [ ] File is saved as UTF-8 without BOM
- [ ] Entries are ordered consistently with the video generation order

---

## Integration Workflow

```
[Hook Generator App]
    |
    |  Generates N hook texts
    |  Exports hooks_export.json
    |
    v
[Hookz App]
    |
    +-- User loads hook videos (Add Hooks button)
    |
    +-- User clicks Import Texts -- selects hooks_export.json
    |
    +-- Texts auto-fill by filename match or positional index
    |
    +-- User clicks Generate -- renders N final videos
```

---

Spec version: 1.0 | Compatible with Hookz v1.0.0+
