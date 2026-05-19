# Known parser limits

The `.applescript` files in this directory are real AppleScript scripts (decompiled from Apple's `/Library/Scripts/`) that the current grammar **cannot fully parse without ERROR nodes**. They are kept here so they're not lost — anyone working on the parser should be able to test against them — but they are excluded from the corpus pass measurement at the parent level.

## Why they're here

Each file exhibits a specific parser limitation documented in [`docs/references/external-scanner/02-lessons-learned.md`](../../../../../docs/references/external-scanner/02-lessons-learned.md). The grammar additions and external scanner (`src/scanner.c`) reduced ERRORs across the whole corpus from 732 → 10 (98.6%), but the remaining 10 errors cluster in these four files and require **column-/position-aware external scanner work** that's a multi-day design project, not a single grammar tweak.

| File | Errors | Root cause |
| --- | ---: | --- |
| `attach_folder_action.applescript` | 3 | Outer `if_block` terminator: `end if` where `if` could be either the optional handler-name or a fresh `keyword_if` starting a new construct. Tree-sitter's GLR picks the wrong one. |
| `remove_folder_actions.applescript` | 3 | Same outer-`if`-terminator cascade as `attach_folder_action.applescript`, plus the `to` ambiguity from `colorsync_extract.applescript`. |

## Resolved

- `colorsync_extract.applescript` — fixed by column-aware `keyword_handler_to` (v1.4.0).
- `comment_tags.applescript` — fixed by bounding multi-word tokens to a single line (Task 3.2). Moved to `edge_cases/`.

## How to re-include these once the parser improves

When a future commit lands a fix that gets one of these files to zero ERROR nodes (verify with `npx tree-sitter parse`), move it back to the appropriate sibling folder (`handlers/`, `object_specifiers/`, `edge_cases/`) and re-run the corpus check.

## What was tried and didn't work this session

See [`docs/references/external-scanner/02-lessons-learned.md`](../../../../../docs/references/external-scanner/02-lessons-learned.md) for the full list. Briefly:

- Three different `compound_word` external-token designs — all regressed the parser globally.
- `compound_name` size reduction (6 words → 3 words) — broke long enum constants like `two hundred fifty six colors`.
- Widening `parameter_name` to include `with X Y Z` 4-word variants — broke longest-match lexing for the bare `with` parameter.
- A `command_flag` rule (which DID land) — correctly handles `with multiple selections allowed` as a single token, but the corpus cascades originate elsewhere in these files (the if-terminator and `to` ambiguity).
- Adding `set_statement` / `copy_statement` / `command_call` to `if_simple_statement`'s tail choice (so that `if x then say "hi"` would parse as a true one-liner): caused ~14 multi-line `if … then\n<command>\n… end if` blocks in the corpus to commit to the one-line form before the parser saw `end if`. `prec.dynamic(2)` on `if_block` was not enough to recover. Reverted.

The roadmap (`README.md`) flags these as needing real engineering work, not LLM-driven incremental edits.

## Known one-liner gap

`if <cond> then <command_call>` (e.g. `if 1 = 1 then say "yes"`) parses as an `if_block` with a `MISSING keyword_end` synthesized at the end of the line. The supported one-line forms are `return`, `exit`, `continue`, `error`, and `log` tails. Rewrite as either:

```applescript
-- supported one-liner
if cond then return value

-- or as a full block
if cond then
    say "yes"
end if
```
