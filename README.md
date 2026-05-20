# tree-sitter-applescript

[AppleScript](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/introduction/ASLR_intro.html) grammar for [tree-sitter](https://tree-sitter.github.io/tree-sitter/).

Powers the [zed-applescript](https://github.com/HelgeSverre/zed-applescript) extension and any other tree-sitter-based tool that wants to syntax-highlight, outline, or otherwise structurally analyse AppleScript source.

## Status

- **36 of 36** real-world AppleScript files from Apple's `/Library/Scripts/`, decompiled Folder Actions and Printing Scripts, plus hand-crafted ASObjC and edge-case samples parse with **zero `ERROR` and zero `MISSING` nodes**. Total reduction from baseline during development: **732 → 0**.
- **94 of 94** fixture tests pass.
- The `known-limits/` quarantine directory is empty.

See [`test/corpus/realworld/ERRORS.md`](test/corpus/realworld/ERRORS.md) for the full milestone history.

## Coverage

Handles the full AppleScript surface, including the parts that make purely regex-based tokenisation hard:

- All handler shapes — `on …(args)`, `to …()`, ObjC-style `on selector:arg byLabel:arg`, Folder-Action multi-word events, labeled (`given …:`) parameters
- Every block construct — `tell`, `if`, `repeat`, `try`/`on error`, `considering`/`ignoring` (with `but` clauses), `with timeout`, `with transaction`, `using terms from`, `script`
- Object specifiers and reference forms — `every`, `first`/`last`/`middle`, `before`/`after`/`behind`/`in front of`/`in back of`, `whose`/`where` filter clauses, ordinal index references
- Literals — strings with escape sequences, numbers (including ordinal forms `1st`/`2nd`), booleans, lists, records, date literals, raw-data literals (`«class fold»`, `«data utxt201C»`), `missing value`
- Pipe-delimited identifiers — `|name with spaces|`
- Multi-word app-dictionary names — `path to home folder`, `current view`, `text item delimiters`, etc. (curated vocabulary + 1–6-word compound names)
- Line continuation `¬`
- Operators — full synonym table (`is greater than` / `is more than` / `>` etc.)
- Possessive `'s` and ObjC bridge — `current application's NSString`, `receiver's selector:arg`
- `use` statements — application, framework, scripting additions, with aliased binding, `version`, `with importing` / `without importing`
- `do shell script`, `run script`, `current date`, `current application`, `me`, `it`, `its`, `result`, `my <expr>`

## External scanner

`src/scanner.c` implements five context-sensitive tokens that tree-sitter's regex lexer can't represent on its own:

| Token | Purpose |
| --- | --- |
| `block_comment` | `(* … *)` that respects string literals and nests |
| `alias_prefix` | `alias` when used as a value prefix (`alias "X"`), distinct from the property `alias of theItem` |
| `piped_identifier` | `\|name with any chars\|` |
| `keyword_handler_to` | `to` at column 0 (a handler definition opener), distinct from `move X to Y` |
| `inline_marker` | zero-width token that allows `if … then` to bind a one-liner tail only when the tail is on the same logical line (same row, or reached through a `¬` continuation) |

Architectural notes from building these live in the consuming extension's [`docs/references/external-scanner/02-lessons-learned.md`](https://github.com/HelgeSverre/zed-applescript/blob/main/docs/references/external-scanner/02-lessons-learned.md).

## Usage

The standard tree-sitter bindings are exposed: Rust crate, npm package, Python package, Swift package. Pin by commit when consuming from another tool — the grammar evolves and new node types appear with new releases.

For local development:

```sh
git clone https://github.com/HelgeSverre/tree-sitter-applescript
cd tree-sitter-applescript
npm install
npx tree-sitter generate     # generate src/parser.c from grammar.js
npx tree-sitter test         # 94 fixture tests
npx tree-sitter parse <file> # parse a file and print the tree
```

To run the real-world regression check:

```sh
for f in $(find test/corpus/realworld -name '*.applescript' -not -path '*/known-limits/*'); do
  out=$(npx tree-sitter parse "$f" 2>&1 | grep -E 'ERROR|MISSING')
  [ -n "$out" ] && echo "FAIL: $f"$'\n'"$out"
done
# Empty output means all 36 files are clean.
```

## References

- [AppleScript Language Guide](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/introduction/ASLR_intro.html) — Apple's archived reference. Definitive but no longer actively maintained.
- [Creating tree-sitter parsers](https://tree-sitter.github.io/tree-sitter/creating-parsers/) — upstream authoring guide, including the [external scanner reference](https://tree-sitter.github.io/tree-sitter/creating-parsers/4-external-scanners.html) that informs `src/scanner.c`.

## License

[MIT](LICENSE).
