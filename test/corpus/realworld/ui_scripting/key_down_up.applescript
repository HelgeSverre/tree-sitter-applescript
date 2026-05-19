(*
 Key Down-Up
 
 This script uses UI element scripting and gives examples of pressing and
 releasing keyboard keys while holding down key modifiers such as shift
 and option.
 
 Copyright © 2013 Apple Inc.
 
 You may incorporate this Apple sample code into your program(s) without
 restriction.  This Apple sample code has been provided "AS IS" and the
 responsibility for its operation is yours.  You are not permitted to
 redistribute this Apple sample code as "Apple sample code" after having
 made changes.  If you're going to redistribute the code, we require
 that you make it clear that the code was descended from Apple sample
 code, but that you've made changes.
 *)
 
 tell application "TextEdit"
    activate
    make new document
 end tell
 
 try
     tell application "System Events"
         tell process "TextEdit"
             set frontmost to true
         end tell
 
         key down option
         keystroke "e"
         delay 1
         key up option
         keystroke "e"
         keystroke return
 
         keystroke "e" using option down
         delay 1
         keystroke "e"
         keystroke return
 
         key down shift
         keystroke "p"
         key up shift
         keystroke return
 
         key down option
         keystroke "p"
         key up option
         keystroke return
 
         key down {shift, option}
         keystroke "p"
         key up {shift, option}
         keystroke return
 
         keystroke "p" using {shift down, option down}
         keystroke return
 
     end tell
on error errMsg
	display dialog "Error: " & errMsg
end try