tell application "Finder"
	-- whose clause with comparison
	set bigFiles to every file of home whose size > 1000000

	-- whose with text predicate
	set txtFiles to every file of home whose name ends with ".txt"

	-- every / first / last / some
	set firstApp to first application file of folder "Applications" of startup disk
	set lastDoc to last document file of home
	set someFolder to some folder of home

	-- middle element
	set midItem to middle item of (every file of home)

	-- index ranges
	set firstThree to items 1 thru 3 of (every file of home)
end tell
