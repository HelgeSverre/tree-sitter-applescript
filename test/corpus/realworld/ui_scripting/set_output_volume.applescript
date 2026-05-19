(*
 Set Output Volume
 
 This script uses UI element scripting to show how to change the sound
 output volume using the Sound System Preference.
 
 Copyright © 2013 Apple Inc.
 
 You may incorporate this Apple sample code into your program(s) without
 restriction.  This Apple sample code has been provided "AS IS" and the
 responsibility for its operation is yours.  You are not permitted to
 redistribute this Apple sample code as "Apple sample code" after having
 made changes.  If you're going to redistribute the code, we require
 that you make it clear that the code was descended from Apple sample
 code, but that you've made changes.
 *)
 
 tell application "System Preferences"
    activate
    set current pane to pane "com.apple.preference.sound"
 end tell
 
 try
     tell application "System Events"
         tell slider 1 of window "Sound" of process "System Preferences"
             if value is 0.5 then
                 set value to 0.8
             else
                 set value to 0.5
             end if
         end tell
     end tell
on error errMsg
	display dialog "Error: " & errMsg
end try