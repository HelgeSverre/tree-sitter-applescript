# Real-world corpus — current state

**36 of 36 active files parse with zero ERROR and zero MISSING nodes — `known-limits/` is now empty.**

## Per-file ERROR counts

| File | ERROR | MISSING |
| --- | ---: | ---: |
| `asobjc/basic_asobjc.applescript` | 0 | 0 |
| `asobjc/foundation_arrays.applescript` | 0 | 0 |
| `edge_cases/comment_tags.applescript` | 0 | 0 |
| `edge_cases/dates_and_continuation.applescript` | 0 | 0 |
| `edge_cases/insertion_points.applescript` | 0 | 0 |
| `edge_cases/whose_and_every.applescript` | 0 | 0 |
| `folder_actions/attach_folder_action.applescript` | 0 | 0 |
| `folder_actions/close_subfolders.applescript` | 0 | 0 |
| `folder_actions/convert_ps_pdf.applescript` | 0 | 0 |
| `folder_actions/image_add_icon.applescript` | 0 | 0 |
| `folder_actions/image_dup_jpeg.applescript` | 0 | 0 |
| `folder_actions/image_flip_vertical.applescript` | 0 | 0 |
| `folder_actions/image_info_to_comment.applescript` | 0 | 0 |
| `folder_actions/image_rotate_right.applescript` | 0 | 0 |
| `folder_actions/new_item_alert.applescript` | 0 | 0 |
| `folder_actions/open_show_comments.applescript` | 0 | 0 |
| `folder_actions/remove_folder_actions.applescript` | 0 | 0 |
| `handlers/disable_folder_actions.applescript` | 0 | 0 |
| `handlers/enable_folder_actions.applescript` | 0 | 0 |
| `idioms/voiceover_screenshot.applescript` | 0 | 0 |
| `idioms/voiceover_unread.applescript` | 0 | 0 |
| `idioms/with_clauses.applescript` | 0 | 0 |
| `object_specifiers/colorsync_embed.applescript` | 0 | 0 |
| `object_specifiers/colorsync_extract.applescript` | 0 | 0 |
| `object_specifiers/colorsync_match.applescript` | 0 | 0 |
| `object_specifiers/colorsync_proof.applescript` | 0 | 0 |
| `object_specifiers/colorsync_set_info.applescript` | 0 | 0 |
| `scripting_extras/convert_pdf.applescript` | 0 | 0 |
| `scripting_extras/convert_ps.applescript` | 0 | 0 |
| `scripting_extras/print_window_subfolders.applescript` | 0 | 0 |
| `scripting_extras/print_window.applescript` | 0 | 0 |
| `ui_scripting/get_user_name.applescript` | 0 | 0 |
| `ui_scripting/key_down_up.applescript` | 0 | 0 |
| `ui_scripting/probe_menu_bar.applescript` | 0 | 0 |
| `ui_scripting/probe_window.applescript` | 0 | 0 |
| `ui_scripting/set_output_volume.applescript` | 0 | 0 |

## Quarantined files

None. All four files originally quarantined this session are now in the
active corpus. The `known-limits/` directory remains for documentation
and as a place to land any future regressions.

## How we got here

| Milestone | ERROR count | Δ |
| --- | ---: | --- |
| Initial baseline (after encoding fixes) | 732 | — |
| After grammar additions through commit `c46503a` | 424 | -42% |
| After grammar additions through commit `1668871` | 143 | -66% |
| After commit `8d600ab` (compound_name expansion, string token, plurals) | 13 | -91% |
| After commit `b3f40dd` (external scanner: block_comment + alias_prefix) | 10 | -98.6% |
| After commit `dc093dc` (command_flag rule) | 10 | unchanged |
| Quarantine 4 files into `known-limits/` | 0 (in active corpus) | — |
| After commit `98fc987` (column-aware keyword_handler_to) | 0 (active corpus, 33/33) | — |
| Task 3.2 (bound multi-word tokens to a single line, un-quarantined `comment_tags.applescript`) | 0 (active corpus, 34/34) | — |
| `inline_marker` external token (forces if-with-tail to a single logical line, widens tail to any `_item`, un-quarantines `attach_folder_action.applescript`) | 0 (active corpus, 35/35) | — |
| Widened `if_simple_statement` tail to {atomic} ∪ {set,copy,command_call,tell_simple_statement}; allowed `keyword_script` in `index_expression`; un-quarantined `remove_folder_actions.applescript` | 0 (active corpus, **36/36**) | known-limits empty |

