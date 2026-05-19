(*
Copyright © 2003 Apple Computer, Inc.

You may incorporate this Apple sample code into your program(s) without
restriction.  This Apple sample code has been provided "AS IS" and the
responsibility for its operation is yours.  You are not permitted to
redistribute this Apple sample code as "Apple sample code" after having
made changes.  If you're going to redistribute the code, we require
that you make it clear that the code was descended from Apple sample
code, but that you've made changes.
*)


on run {}
	tell application "Finder" to set FinderSelection to the selection as alias list
	
	set FS to FinderSelection
	--Ideally, this list could be passed to the open handler
	
	set SelectionCount to number of FS -- count	
	if SelectionCount is 0 then
		set FS to userPicksFolder()
	else if the SelectionCount is 1 then
		set MyPath to path to me
		if MyPath is item 1 of FS then
			--If I'm a droplet then I was double-clicked
			set FS to userPicksFolder()
		end if
	else
		--I'm not a double-clicked droplet
	end if
	
	open FS
end run

on userPicksFolder()
	set these_items to {}
	set these_items to (choose folder with prompt "Select a folder whose contents you wish to print:") as list
end userPicksFolder

property pShortPath : ""

on open these_items
	set the item_info to {}
	repeat with i from 1 to the count of these_items
		set this_item to (item i of these_items)
		set the item_info to info for this_item
		if folder of the item_info is true then --if the item is a folder
			set pShortPath to (item i of these_items as string)
			set thePOSIXFilePath to POSIX path of pShortPath as string
			processFolder(thePOSIXFilePath)
		end if
	end repeat
end open


on processFolder(theFolder)
	set OldDelims to AppleScript's text item delimiters
	set AppleScript's text item delimiters to "/"
	set newTextList to text items of theFolder
	set x to the count of newTextList
	set printedPath to items 1 thru (x - 1) of newTextList as string
	set AppleScript's text item delimiters to OldDelims
	
	try
		set theShellScript to ("( echo " & printedPath & " && ls -R  \"" & printedPath & "\"  ) | lpr " as string)
		do shell script theShellScript
	on error ErrMsg number ErrNmbr
		tell application "Finder"
			display dialog ErrMsg & "
Error: " & ErrNmbr buttons {"OK"} with icon note
		end tell
	end try
end processFolder


