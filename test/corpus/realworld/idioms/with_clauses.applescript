-- Commands with multiple `with` and `without` parameter clauses
display dialog "Continue?" buttons {"No", "Yes"} default button "Yes" ¬
	with icon stop with title "Confirm" giving up after 30

display notification "Build complete" with title "CI" subtitle "Passed" sound name "Glass"

choose file with prompt "Pick a file" of type {"public.text"} default location (path to home folder) ¬
	with multiple selections allowed without invisibles

-- exit repeat as a two-keyword statement
repeat with i from 1 to 10
	if i > 5 then exit repeat
end repeat

-- One-line if/then with a `return` tail (supported form).
-- Note: `if cond then <command_call>` (e.g. `if 1 = 1 then say "yes"`)
-- is a known limit — see test/corpus/realworld/known-limits/README.md.
on probe()
	if 1 = 1 then return "yes"
end probe
