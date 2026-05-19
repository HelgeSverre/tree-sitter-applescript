# Real-world corpus — gap analysis

**Original baseline:** 36 files, 4 clean (11%), **663 ERROR nodes**, 0 MISSING.
**After encoding fixes** (UTF-16BE / Mac Roman → UTF-8 in `ui_scripting/`, `object_specifiers/colorsync_*`): 36 files, 4 clean, **732 ERROR nodes**. Previous "low" error counts in those folders reflected the parser refusing to read them, not actually parsing them cleanly. Treat 732 as the real Phase 1 baseline.

**After Phase 2, partial:** 36 files, 4 clean, **732 ERROR nodes**. See "Phase 2 status" below for why the needle didn't move.

## Phase 2 status — partial; paused for review

Three grammar improvements were applied:

- **G1 done.** `¬` moved from `unary_operator` to `extras`. Parses involving line continuation now produce correct trees (verified in isolation: `display dialog "x" ¬ \n with title "y"` becomes a single `command_call`). Corpus ERROR count unchanged because the previous parser was already recovering around `¬` by classifying it as `unary_expression`, contributing ~1–2 errors per occurrence rather than cascading.
- **G4 done.** `whose_clause` added to `object_specifier`. **Does not activate in the corpus**, see G0 below.
- **G6 partial.** Added `begins with`, `does not start with`, `does not begin with`, `does not end with` to `comparison_operator`. Verified in isolation. Also does not activate in the corpus, same reason.

### G0. Missing `word: $ => $.identifier` declaration (newly discovered, blocking)

Tree-sitter has no idea that the `ci(...)` keyword tokens are meant to be matched only as whole words. With no `word` field in the grammar, keywords are happily tokenized inside identifiers. Demonstrated:

```
set x to every file of home whose size > 1000
```

…parses with `home` split as `ho` (ERROR) + `me` (matched as `me_reference`), and `of` matched as a stray identifier rather than as the `of` keyword. The `whose_clause` rule from G4 never gets a chance to fire because the surrounding expression is already wrecked.

**Fix:** add `word: $ => $.identifier` to the grammar declaration. This tells tree-sitter to treat every `ci(...)` keyword as a complete-word token. Until this is in place, **all of G2–G13 will be undermined** by the same tokenizer leakage.

- **Risk:** medium — every existing `ci(...)` token changes lexer behavior. Some existing tests may shift. Worth running the existing `test/corpus/*.txt` suite immediately after the change and updating fixtures.
- **Why I paused:** per the goal brief, "Ask before destructive grammar restructuring. Small rule additions: just do it. Refactoring the precedence of expression rules or renaming widely-used nodes: pause and confirm — query files will silently break." A `word` declaration changes lexer behavior across the whole grammar; combined with G2 (`'s` possessive) and G3 (ObjC selectors), it warrants a human checkpoint.

### Recommended next steps for a human

1. Add `word: $ => $.identifier` to the grammar. Regenerate. Run `npx tree-sitter test`. Update any fixture diffs.
2. Re-measure corpus error count. Expect a significant drop from existing rules suddenly working correctly.
3. Then tackle G2 (`'s` postfix accessor) and G3 (ObjC selector syntax). These are coupled and need expression-precedence design.
4. Then revisit G7 (chained `with`/`without` command parameters) — likely largely fixed by step 1 alone.

The remaining categorized gaps (G5, G6 main, G8–G12) are accurate but their *measured impact* won't be visible until G0 is fixed.

Per-file counts are at the bottom (auto-generated). This section catalogs the **categories** of grammar gap that produce those errors, sorted by leverage.

## High-leverage gaps

### G1. Line continuation `¬` is treated as unary `not`

`¬` (U+00AC) is registered in `unary_operator` (`grammar.js:727`). In real AppleScript it is the line-continuation glyph only; `not` is the logical-negation operator. Treating `¬` as unary cascades into bogus `unary_expression` nodes that swallow following expressions and break every subsequent statement in the file.

- **Fix:** Move `¬` (optionally followed by newline) to `extras` so it parses as whitespace. Remove `"¬"` from `unary_operator`.
- **Files affected:** every script using `display dialog … ¬ \n with title …` — most of `scripting_extras/`, `idioms/with_clauses.applescript`, `edge_cases/dates_and_continuation.applescript`.
- **Risk:** very low.

### G2. Possessive `'s` operator is unsupported

`current application's NSString's stringWithString:` is the dominant idiom in modern AppleScript / ASObjC. The `'s` token isn't in the grammar, so every `'s` becomes an ERROR and the rest of the expression cascades.

- **Fix:** Add `'s` as a postfix accessor on expressions, producing a property reference. Interacts with expression precedence.
- **Files affected:** all of `asobjc/`, `edge_cases/dates_and_continuation.applescript`.
- **Risk:** medium — touches expression precedence and may require new conflicts.

### G3. ObjC bridge selectors `name:arg [label:arg …]`

ASObjC method calls and handler definitions: `theArray's sortedArrayUsingSelector:"compare:"`, `on splitString:theString byDelim:theDelim`.

- **Fix:** New productions for method-call selectors and labeled-selector handler defs.
- **Files affected:** all of `asobjc/`.
- **Risk:** medium. Depends on G2.

### G4. `whose` / `where` filter clauses

`every file of home whose size > 1000000`, `every file whose name ends with ".txt"`.

- **Fix:** Add `whose_clause: seq(ci("whose"), $._expression)` as optional tail of `object_specifier`.
- **Risk:** low — additive.

### G5. Element-prefix keywords (`first`, `last`, `middle`, `some`, `any`)

`first application file of folder …`, `last document file of home`, `some folder of home`, `middle item of (…)`.

- **Fix:** Extend `specifier_prefix` to include the ordinal prefixes.
- **Risk:** low.

### G6. Text-predicate comparison operators

`name ends with ".txt"`, `x contains "y"`, `starts with`, `begins with`, `does not contain`, `is in`, `is not in`.

- **Fix:** Extend `comparison_operator` token to include the text-predicate forms.
- **Risk:** low.

### G7. Chained `with` / `without` command-parameter clauses

`make new folder at this_folder with properties {name:done_foldername}`, `display dialog … with icon stop with title "X" giving up after 30`, `choose file … with multiple selections allowed without invisibles`. The grammar's `command_parameter` only handles `name:value` form.

- **Fix:** Add variants:
  - `with` + identifier (flag) — `with multiple selections allowed`
  - `without` + identifier — `without invisibles`
  - `with` + identifier-or-keyword + value — `with title "X"`, `with icon stop`
  - `with properties` + record
  - `giving up after` + number
- **Risk:** low–medium.

### G8. Record entries with reserved-looking keys

`{name:done_foldername}` — `name`, `kind`, `class`, `id`, `version` may be claimed elsewhere.

- **Fix:** Verify `record_entry` (`grammar.js:657`) accepts identifier-equivalent keys. Investigation first.
- **Risk:** low.

## Medium-leverage gaps

### G9. Date literals: `date "…"` and `current date`

- **Fix:** Add `date_literal: seq(ci("date"), $.string)`. Add `current_date: seq(ci("current"), ci("date"))`.
- **Risk:** low.

### G10. `path to <special>` constructs

`path to home folder`, `path to me`, `path to desktop folder`.

- **Fix:** Add `path_to_expression` or whitelist special folder constants.
- **Risk:** medium — open-ended set.

### G11. `a reference to <expr>`

`property NSString : a reference to current application's NSString`.

- **Fix:** Add `reference_expression: seq("a", ci("reference"), ci("to"), $._expression)`.
- **Risk:** low.

### G12. `on error … number …`

`on error error_message number error_number`.

- **Fix:** Extend `error_parameters`/`error_handler` to allow optional `number identifier` after the message.
- **Risk:** low.

### G13. Multi-word application constants inside `using terms from`

`{Eight channel, Eight color, RGB, Lab, XYZ, CMYK, Gray}` — `Eight channel` is one logical constant, parses as two identifiers. AppleScript's tokenizer resolves these via the application's `.sdef` dictionary; tree-sitter can't replicate that.

- **Decision:** Accept that multi-word app constants parse as separate identifiers. Document in README.

## Low-leverage / cosmetic

- **G14.** Confirm one-line `if … then exit repeat` works (`if_simple_statement` must accept `exit_statement`).
- **G15.** Implicit `on run` for top-level statements — already supported via `source_file: repeat($._item)`. Skip.
- **G16.** Curly quotes in source — decide later; currently low priority since `osadecompile` output is straight-quoted.

## Recommended attack order

| # | Gap | Risk | Est. impact |
| --- | --- | --- | --- |
| 1 | G1 — continuation `¬` as extras | very low | high |
| 2 | G4 — `whose` clause | low | medium |
| 3 | G5 — element prefixes | low | low |
| 4 | G6 — text comparison ops | low | medium |
| 5 | G7 — chained `with`/`without` params | medium | very high |
| 6 | G8 — verify record-entry keys | low | medium |
| 7 | G12 — `error … number …` | low | low |
| 8 | G11 — `a reference to …` | low | low |
| 9 | G9 — date literals + `current date` | low | low |
| **PAUSE** | G2 + G3 — `'s` possessive and ObjC selectors | medium | very high |
| later | G10 — `path to <special>` | medium | medium |
| later | G13 — multi-word identifiers | high (architectural) | — |

G2 + G3 deliver the largest single-step error reduction but require expression-precedence work. Per the goal brief, pause and confirm before that step if it requires renaming existing nodes or breaking query compatibility.

---

## Per-file ERROR counts (baseline)

| File | ERROR | MISSING |
| --- | ---: | ---: |
| `asobjc/basic_asobjc.applescript` | 29 | 0 |
| `asobjc/foundation_arrays.applescript` | 34 | 0 |
| `edge_cases/comment_tags.applescript` | 24 | 0 |
| `edge_cases/dates_and_continuation.applescript` | 3 | 0 |
| `edge_cases/insertion_points.applescript` | 6 | 0 |
| `edge_cases/whose_and_every.applescript` | 20 | 0 |
| `folder_actions/close_subfolders.applescript` | 3 | 0 |
| `folder_actions/convert_ps_pdf.applescript` | 57 | 0 |
| `folder_actions/image_add_icon.applescript` | 39 | 0 |
| `folder_actions/image_dup_jpeg.applescript` | 55 | 0 |
| `folder_actions/image_flip_vertical.applescript` | 39 | 0 |
| `folder_actions/image_info_to_comment.applescript` | 142 | 0 |
| `folder_actions/image_rotate_right.applescript` | 39 | 0 |
| `folder_actions/new_item_alert.applescript` | 17 | 0 |
| `folder_actions/open_show_comments.applescript` | 11 | 0 |
| `handlers/attach_folder_action.applescript` | 12 | 0 |
| `handlers/disable_folder_actions.applescript` | 3 | 0 |
| `handlers/enable_folder_actions.applescript` | 3 | 0 |
| `handlers/remove_folder_actions.applescript` | 9 | 0 |
| `idioms/voiceover_screenshot.applescript` | 9 | 0 |
| `idioms/voiceover_unread.applescript` | 5 | 0 |
| `idioms/with_clauses.applescript` | 0 | 0 |
| `object_specifiers/colorsync_embed.applescript` | 0 | 0 |
| `object_specifiers/colorsync_extract.applescript` | 9 | 0 |
| `object_specifiers/colorsync_match.applescript` | 0 | 0 |
| `object_specifiers/colorsync_proof.applescript` | 0 | 0 |
| `object_specifiers/colorsync_set_info.applescript` | 2 | 0 |
| `scripting_extras/convert_pdf.applescript` | 19 | 0 |
| `scripting_extras/convert_ps.applescript` | 19 | 0 |
| `scripting_extras/print_window_subfolders.applescript` | 20 | 0 |
| `scripting_extras/print_window.applescript` | 20 | 0 |
| `ui_scripting/get_user_name.applescript` | 3 | 0 |
| `ui_scripting/key_down_up.applescript` | 3 | 0 |
| `ui_scripting/probe_menu_bar.applescript` | 3 | 0 |
| `ui_scripting/probe_window.applescript` | 3 | 0 |
| `ui_scripting/set_output_volume.applescript` | 3 | 0 |

**Summary:** 36 files · 4 clean · 663 ERROR · 0 MISSING
