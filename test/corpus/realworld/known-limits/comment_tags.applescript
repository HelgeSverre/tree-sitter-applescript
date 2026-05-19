(*
Comment Tags

Copyright © 2001–2007 Apple Inc.

You may incorporate this Apple sample code into your program(s) without
restriction.  This Apple sample code has been provided "AS IS" and the
responsibility for its operation is yours.  You are not permitted to
redistribute this Apple sample code as "Apple sample code" after having
made changes.  If you're going to redistribute the code, we require
that you make it clear that the code was descended from Apple sample
code, but that you've made changes.
*)

set CR to ASCII character 13
set NL to ASCII character 10

tell application "Script Editor"
	tell front document
		--tell document 2 --Debug mode
		set the target_string to "--XXXX"
		
		set the selected_text to contents of selection
		
		if the selected_text is not "" then
			if the selected_text contains "(*" and the selected_text contains "*)" then
				--Could be a remove or another add
				set BlockStart to the selected_text starts with "(*" & CR or the selected_text starts with "(*" & NL
				set BlockEnd to the selected_text ends with "*)" & CR or the selected_text ends with "*)" & NL
				if BlockStart and BlockEnd then
					--Case as normally created by this script
					set contents of selection to characters 4 through -4 of selected_text as text
				else
					set BlockStart to the selected_text starts with "(*"
					set BlockEnd to the selected_text ends with "*)"
					if BlockStart and BlockEnd then
						--Block starts with "(*" exactly and ends with "*)" exactly
						set contents of selection to characters 3 through -3 of selected_text as text
					else
						--find first occurrence of "(*"
						set BlockStartOffset to offset of "(*" in selected_text
						--find last occurrence of "*)"
						set SelectionLength to length of selected_text
						set BlockEndOffset to SelectionLength - ¬
							(offset of ")*" in (reverse of (characters of selected_text) as text))
						log {BlockStartOffset, BlockEndOffset, SelectionLength}
						
						if BlockStartOffset is less than BlockEndOffset then
							if BlockStart then
								--Block starts with "(*", but "*)" is somewhere before end of selection
								set Newtext to (characters 3 through (BlockEndOffset - 1) of selected_text as text) & ¬
									characters (BlockEndOffset + 2) through -1 of selected_text as text
								set contents of selection to Newtext
							else
								if BlockEnd then
									--Block ends with "*)", but "(*" is somewhere past beginning of selection
									set Newtext to (characters 1 through (BlockStartOffset - 1) of selected_text as text) & ¬
										characters (BlockStartOffset + 2) through -3 of selected_text as text
									set contents of selection to Newtext
								else
									--Block start and end are not at the selection end points (extract three blocks of text)
									set Newtext to ((characters 1 through (BlockStartOffset - 1) of selected_text as text) & ¬
										characters (BlockStartOffset + 2) through (BlockEndOffset - 1) of selected_text as text) & ¬
										characters (BlockEndOffset + 2) through -1 of selected_text as text
									set contents of selection to Newtext
								end if
							end if
						else
							if true then
								--Must be a request to add comment block
								if the last character of selected_text is in {CR, NL} then
									set contents of selection to "(*" & return & ¬
										selected_text & ¬
										"*)" & return
								else
									set contents of selection to return & ¬
										"(*" & return & ¬
										selected_text & return & ¬
										"*)" & return
								end if
							else
								--display dialog "Invalid block comment range selected." with icon stop buttons "OK" default button 1
							end if
						end if
					end if
				end if
			else
				--Must be a request to add comment block
				if the last character of selected_text is in {CR, NL} then
					set contents of selection to "(*" & return & ¬
						selected_text & ¬
						"*)" & return
				else
					set contents of selection to return & ¬
						"(*" & return & ¬
						selected_text & return & ¬
						"*)" & return
				end if
			end if
		else
			display dialog "Select some text before invoking this script command." with icon stop buttons "OK" default button 1
		end if
	end tell
end tell


(*
on replace_and_select(target_string, replacement_string)
	tell application "Script Editor"
		tell the front document
			set this_text to the contents
			set this_offset to the offset of the target_string in this_text
			if this_offset is not 0 then
				set selection to characters this_offset thru (this_offset + (length of the target_string) - 1)
				set the contents of the selection to the replacement_string
			else
				set selection to {}
			end if
		end tell
	end tell
end replace_and_select
*)

(*
--Global remove is too extensive
set this_text to my replace_chars(selected_text, "(*", "")
set this_text to my replace_chars(this_text, "*)", "")
set the contents of the selection of the front document to this_text
*)

(*
on replace_chars(this_text, search_string, replacement_string)
	set AppleScript's text item delimiters to the search_string
	set the item_list to every text item of this_text
	set AppleScript's text item delimiters to the replacement_string
	set this_text to the item_list as string
	set AppleScript's text item delimiters to ""
	return this_text
end replace_chars
*)
