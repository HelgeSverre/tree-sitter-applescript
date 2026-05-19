(*
Attach Script to Folder

This script attaches an AppleScript to a Folder.
This script uses the object model of Folder Actions.


Copyright © 2007 Apple Inc.

You may incorporate this Apple sample code into your program(s) without
restriction.  This Apple sample code has been provided "AS IS" and the
responsibility for its operation is yours.  You are not permitted to
redistribute this Apple sample code as "Apple sample code" after having
made changes.  If you're going to redistribute the code, we require
that you make it clear that the code was descended from Apple sample
code, but that you've made changes.
*)

property ChooseScriptPrompt : "Select compiled script file(s) containing folder actions"
property ChooseFolderPrompt : "Select a folder to attach actions"
property ErrorMsg : " is not a compiled script. (Ignored)."

on open DroppedItems
	choose folder with prompt ChooseFolderPrompt
	set TargetFolder to the result as text
	tell application "Finder" to ¬
		set FAName to name of alias TargetFolder
	tell application "System Events"
		if folder action FAName exists then
			--Don't make a new one
		else
			make new folder action ¬
				at end of folder actions ¬
				with properties {path:TargetFolder} -- name:FAName, 
		end if
	end tell
	
	repeat with EachItem in DroppedItems
		set ItemInfo to info for EachItem
		if not folder of ItemInfo then
			set FileTypeOfItem to file type of ItemInfo
			set FileExtensionOfItem to name extension of ItemInfo
			set ItemName to name of ItemInfo
			if FileTypeOfItem is "osas" or FileExtensionOfItem is "scpt" then
				tell application "System Events"
					tell folder action FAName
						make new script ¬
							at end of scripts ¬
							with properties {name:ItemName}
					end tell
				end tell
			else
				display dialog ItemName & ErrorMsg with icon caution
			end if
		end if
	end repeat
end open

on run
	my ChooseFileFromFAScriptFolder()
	open the result
end run


to ChooseFileFromFAScriptFolder()
	try
		set LibraryScripts to list folder (path to Folder Action scripts folder from local domain) without invisibles
	on error
		set LibraryScripts to {}
	end try
	try
		set UserScripts to list folder (path to Folder Action scripts folder from user domain) without invisibles
	on error
		set UserScripts to {}
	end try
	if (count LibraryScripts) + (count UserScripts) is greater than 0 then
		set ChosenScripts to choose from list LibraryScripts & UserScripts with prompt ChooseScriptPrompt ¬
			with multiple selections allowed
		if class of ChosenScripts is boolean then
			error number -128
		else
			set SelectedScripts to {}
			repeat with EachScript in ChosenScripts
				if EachScript is in LibraryScripts then
					copy alias ((path to Folder Action scripts folder from local domain as Unicode text) & EachScript) to end of SelectedScripts
				else if EachScript is in UserScripts then
					copy alias ((path to Folder Action scripts folder from user domain as Unicode text) & EachScript) to end of SelectedScripts
				end if
			end repeat
			return SelectedScripts
		end if
	end if
	return {}
end ChooseFileFromFAScriptFolder
