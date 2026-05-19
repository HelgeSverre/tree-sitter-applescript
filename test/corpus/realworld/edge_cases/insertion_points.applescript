tell application "TextEdit"
	make new document
	-- insertion points: beginning, end, before, after
	make new paragraph at beginning of text of document 1 with data "First line"
	make new paragraph at end of text of document 1 with data "Last line"
	make new word before word 1 of text of document 1 with data "Prepended"
	make new word after last word of text of document 1 with data "Appended"
end tell
