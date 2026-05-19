(*
Embed - Use sips to embed a profile into an image.

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
	display dialog "Embed a profile into an image."
	set chosenFile to choose file with prompt "Choose an image " default location path to desktop folder
	open chosenFile
end run


on open draggedItems
	set embedProf to choose file with prompt "Choose profile to embed" default location POSIX file "/System/Library/ColorSync/Profiles"
	repeat with thisFile in (draggedItems as list)
		try
			-- use 'sips --embedProfile' to embed the specified profile
			-- or use 'sips --embedProfileIfNone' to embed the specified profile only if the image doesn't have an embeded profile
			set profPath to quoted form of POSIX path of embedProf
			set filePath to quoted form of POSIX path of thisFile
			set cmdLine to ("sips --embedProfile " & profPath & " " & filePath) as string
			do shell script cmdLine
		end try
	end repeat
end open
