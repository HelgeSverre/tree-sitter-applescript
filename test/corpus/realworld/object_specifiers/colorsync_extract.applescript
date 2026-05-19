(*
Extract - Use sips to extract a color profile from an image and save it to disk.

Copyright © 2009–2020 Apple Inc.

You may incorporate this Apple sample code into your program(s) without
restriction.  This Apple sample code has been provided "AS IS" and the
responsibility for its operation is yours.  You are not permitted to
redistribute this Apple sample code as "Apple sample code" after having
made changes.  If you're going to redistribute the code, we require
that you make it clear that the code was descended from Apple sample
code, but that you've made changes.

*)

on run
	display dialog "Extract the embedded profile from an image."
	set chosenFile to choose file with prompt "Choose an image"
	open chosenFile
end run


on open draggedItems
	repeat with thisFile in (draggedItems as list)
		try
			set filePath to quoted form of POSIX path of thisFile
			set cmdLine to ("sips -g profile " & filePath) as string
			set infoString to do shell script cmdLine
			
			set originalDelimiters to AppleScript's text item delimiters
			set AppleScript's text item delimiters to ": "
			set internalName to item 2 of (text items of infoString)
			set AppleScript's text item delimiters to originalDelimiters
			
			if internalName is equal to "<nil>" then
				activate
				display dialog "no profile in " & (thisFile as text) buttons {"OK"} default button 1
			else
				set strCount to count characters of internalName
				if strCount > 251 then
					set newProfileName to ((characters 1 through 251 of internalName) & ".icc") as string
				else
					set newProfileName to (internalName & ".icc") as string
				end if
				activate
				set newFilePath to choose file name default name newProfileName with prompt "Save profile as..."
				tell application "Finder"
					try
						move item (newFilePath as alias) to trash
					end try
				end tell
				set newFilePosixPath to quoted form of POSIX path of newFilePath
				set imageFilePosixPath to quoted form of POSIX path of thisFile
				set cmdLine to ("sips --extractProfile " & newFilePosixPath & " " & imageFilePosixPath) as string
				do shell script cmdLine
			end if
			
		end try
	end repeat
end open


