# Margin · private note search

Find the study note you remember writing but can’t remember naming. Margin is a small, offline search desk for **Markdown and plain text**. It uses a real BM25 keyword ranking algorithm rather than sending notes to a chat service.

## Try it

1. Download or clone this repository and open **`index.html`** in a modern browser. No installation, server, build step or API key. Keep `styles.css`, `search.js` and `app.js` alongside the HTML.
2. Try **ranking** on the sample shelf. “Why rare words matter” should come first. Open a result to read the whole note. Press **/** to focus search and **Escape** to clear a focused search or dismiss the reader.
3. Choose or drop `.md`, `.markdown` or `.txt` files. The first successful import replaces the demo shelf. Further imports add to your shelf; a file with the **same exact filename** replaces the old in-memory copy. Nothing is written to disk.

## How it ranks

`search.js` builds an inverted index once per import. Queries match whole, case-insensitive Unicode words; `C++` and `C#` are distinct tokens. Matching any query word qualifies a note. Each distinct query term contributes BM25 with `k1 = 1.2` and `b = 0.75`: rare terms count more, repetition has diminishing returns, and long notes receive a length adjustment. Title tokens are counted twice in addition to the original note. Equal scores break by title, then filename.

There is **no** generative model, stemming, phrase matching, synonym expansion or fuzzy matching. A query for `vectors` will not match `vector`. A blank query browses titles alphabetically. Markdown is displayed as **plain text**, not executed or rendered as HTML.

## Privacy and limits

- All indexing happens in the tab. No uploads, analytics, network APIs, cookies, browser storage or search-history logging. Clearing the shelf or reloading removes your imported library from the app. This is not an encrypted vault or secure erasure tool.
- UTF-8 text only, up to 1 MiB per file, 4 MiB total, and 80 distinct filenames. Oversized, empty, binary or invalid files are skipped with a status message. Invalid imports alone never remove the current shelf.
- The first `# Heading` becomes the note title; otherwise Margin uses the filename. For best results, use descriptive titles and keep one topic per note.

## Develop and test

No package manager needed. With Node.js 18 or later:

```sh
node --test tests/search.test.cjs
```

`search.js` contains the tokenizer, index, ranking and excerpt logic. `app.js` handles file import, the library and the reader. `styles.css` and `index.html` define the accessible, responsive interface. To smoke-test the UI, import a note, replace it with a different file of the same name, open its result, and clear the shelf. The file on disk must be unchanged.
