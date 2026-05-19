# Known parser limits

**This directory is currently empty of `.applescript` files.** All four files originally quarantined this session (`colorsync_extract`, `comment_tags`, `attach_folder_action`, `remove_folder_actions`) are now in the active corpus.

The folder is kept as a documented place for future grammar regressions to land.

## History

| File | Resolved in | Root cause + fix |
| --- | --- | --- |
| `colorsync_extract.applescript` | v1.4.0 | `move X to trash` inside `tell` was mis-parsed as a handler header (`to` ambiguity). Fix: column-aware `keyword_handler_to` external token. |
| `comment_tags.applescript` | v1.5.0 | Post-block-comment cascade rooted in multi-word `token()`s greedily matching across newlines. Fix: replaced 133 `/\s+/` with `/[ \t]+/` inside multi-word tokens. |
| `attach_folder_action.applescript` | v1.6.0 | Nested `if … then return … / end if / end if` parsed as `if_simple_statement` instead of `if_block`. Fix: `inline_marker` external token requires same-logical-line tail; widened tail to non-block single-statement shapes. |
| `remove_folder_actions.applescript` | v1.7.0 | `tell ... to delete script X of folder action Y` failed because `script` was tokenised as `keyword_script` (script-block keyword) and couldn't appear as an element type. Fix: `index_expression` now accepts `keyword_script` as an alternative to `element_type`. |

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
