(*
Proof - Use sips to proof an image through an intermediate color space into a destination color space.

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
	display dialog "Proof an image through one space into another space."
	set chosenFile to choose file with prompt "Choose an image " default location path to desktop folder
	open chosenFile
end run


on open draggedItems
	set proofProf to choose file with prompt "Choose an intermediate space profile" default location POSIX file "/System/Library/ColorSync/Profiles"
	set destProf to choose file with prompt "Choose a destination space profile" default location POSIX file "/System/Library/ColorSync/Profiles"
	repeat with thisFile in (draggedItems as list)
		try
			set proofProfPath to quoted form of POSIX path of proofProf
			set destProfPath to quoted form of POSIX path of destProf
			set filePath to quoted form of POSIX path of thisFile
			set cmdLine to ("sips --matchTo " & proofProfPath & " " & filePath) as string
			do shell script cmdLine
			set cmdLine to ("sips --matchTo " & destProfPath & " " & filePath) as string
			do shell script cmdLine
		end try
	end repeat
end open
