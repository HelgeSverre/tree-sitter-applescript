(*
 Probe Window
 
 This script uses UI element scripting to get information about the top window in the Finder.
 
 Copyright © 2013 Apple Inc.
 
 You may incorporate this Apple sample code into your program(s) without
 restriction.  This Apple sample code has been provided "AS IS" and the
 responsibility for its operation is yours.  You are not permitted to
 redistribute this Apple sample code as "Apple sample code" after having
 made changes.  If you're going to redistribute the code, we require
 that you make it clear that the code was descended from Apple sample
 code, but that you've made changes.
 *)
 
 tell application "Finder"
    activate
 end tell
 
 try
     tell application "System Events"
         get properties
         tell process "Finder"
 
             get every UI element
 
             tell window 1
 
                 get every button
                 get properties of every button
                 get every UI element of every button
 
                 get every static text
                 get properties of every static text
                 get every UI element of every static text
 
                 get every scroll bar
                 get properties of every scroll bar
                 get every UI element of every scroll bar
 
                 get every UI element whose class is not button and class is not static text and class is not scroll bar
                 get properties of every UI element whose class is not button and class is not static text and class is not scroll bar
 
                 display dialog "The 'Probe Window' script was executed, it uses UI element scripting to get information about the top window in the Finder, to see results run it within AppleScript Editor."
             end tell
         end tell
     end tell
on error errMsg
	display dialog "Error: " & errMsg
end try