(*
Set Info - Use sips to set image or profile property keys.
In Terminal do 'sips -H' to see which properties can be set.

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
	display dialog "Set image or profile properties."
	set chosenFile to choose file with prompt "Choose a color profile" default location path to desktop folder
	open chosenFile
end run


on open draggedItems
	display dialog "Example only. Drag this application onto Script Editor to edit."
	repeat with thisFile in (draggedItems as list)
		try
			set filePosixPath to quoted form of POSIX path of thisFile
			set theTag to quoted form of "quality"
			set theValue to quoted form of "best"
			set filePosixPathNew to quoted form of (POSIX path of thisFile & " new") as string
			set cmdLine to ("sips -s " & theTag & " " & theValue & " " & filePosixPath & " --out " & filePosixPathNew) as string
			-- commented out as example only
			--do shell script cmdLine
		end try
	end repeat
end open
