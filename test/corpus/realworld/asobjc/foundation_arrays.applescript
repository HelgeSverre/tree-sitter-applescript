use framework "Foundation"
use scripting additions

on sortList:theList
	set theArray to current application's NSArray's arrayWithArray:theList
	set sortedArray to theArray's sortedArrayUsingSelector:"compare:"
	return sortedArray as list
end sortList:

on splitString:theString byDelim:theDelim
	set ns to current application's NSString's stringWithString:theString
	set theArray to ns's componentsSeparatedByString:theDelim
	return theArray as list
end splitString:byDelim:

set myList to {"banana", "apple", "cherry"}
sortList:myList
splitString:"a,b,c,d" byDelim:","
