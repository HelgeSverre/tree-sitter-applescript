# Known parser limits

The single `.applescript` file in this directory is a real AppleScript script (decompiled from Apple's `/Library/Scripts/`) that the current grammar **cannot fully parse without ERROR nodes**. It is kept here so it isn't lost — anyone working on the parser should be able to test against it — but it is excluded from the corpus pass measurement at the parent level.

## Why it's here

The file exhibits a specific parser limitation documented in [`docs/references/external-scanner/02-lessons-learned.md`](../../../../../docs/references/external-scanner/02-lessons-learned.md). Across the v1.0–v1.6 grammar work the corpus went from 732 → 0 errors across 35/35 active files; the one quarantined case here hits the rule-level cross-newline `compound_name` extension which the token-level fixes in v1.5.0 didn't cover.

| File | Errors | Root cause |
| --- | ---: | --- |
| `remove_folder_actions.applescript` | 3 | Rule-level cross-newline `compound_name` extension. `tell app "Sys" to ¬\n  delete folder action X` followed by `end if` on the next line: the parser's rule-level `extras` skip the newline before the next `compound_name` continuation, so the `end repeat` / `end if` tokens further down get pulled into a multi-line `compound_name`. The fix needs a row-tracking external token used inside `compound_name`'s rule continuation, not just inside multi-word tokens. |

## Resolved

- `colorsync_extract.applescript` — fixed by column-aware `keyword_handler_to` (v1.4.0).
- `comment_tags.applescript` — fixed by bounding multi-word tokens to a single line (v1.5.0). Moved to `edge_cases/`.
- `attach_folder_action.applescript` — fixed by the `inline_marker` external token (v1.6.0) — disambiguates nested `if ... then return ... / end if / end if`, which was the cascade source. Moved to `folder_actions/`.

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
