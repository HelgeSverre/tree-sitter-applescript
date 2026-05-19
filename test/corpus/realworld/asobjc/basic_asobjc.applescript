use framework "Foundation"
use framework "AppKit"
use scripting additions

property NSString : a reference to current application's NSString
property NSWorkspace : a reference to current application's NSWorkspace

on URLEncode(theText)
	set theString to current application's NSString's stringWithString:theText
	set encoded to theString's stringByAddingPercentEncodingWithAllowedCharacters:(current application's NSCharacterSet's URLQueryAllowedCharacterSet)
	return encoded as text
end URLEncode

on frontmostBundleID()
	set ws to current application's NSWorkspace's sharedWorkspace
	set frontApp to ws's frontmostApplication
	return (frontApp's bundleIdentifier) as text
end frontmostBundleID

URLEncode("hello world &amp; friends")
