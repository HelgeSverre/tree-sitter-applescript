-- Date literals
set theBirthday to date "Saturday, January 1, 2000 at 12:00:00 AM"
set rightNow to current date

-- Continuation character ¬ spans logical lines
display dialog "A very long message that wraps onto " & ¬
	"the next line for readability." buttons {"OK"} ¬
	default button "OK" with title "Hello"

-- Possessive 's
tell application "Finder"
	set theName to (window 1)'s name
end tell

-- Implicit run handler at top level (statements above are part of it)
on run
	-- Explicit run handler
	display dialog "Explicitly run"
end run
