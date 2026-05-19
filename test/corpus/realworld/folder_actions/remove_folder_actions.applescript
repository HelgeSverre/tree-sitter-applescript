(*
Remove Folder Actions

This script brings up a dialog with a list of attached folder actions for the selected
folder and lets you remove any of those actions.
This script uses the object model of Folder Actions.


Copyright © 2007 Apple Inc.

You may incorporate this Apple sample code into your program(s) without
restriction.  This Apple sample code has been provided "AS IS" and the
responsibility for its operation is yours.  You are not permitted to
redistribute this Apple sample code as "Apple sample code" after having
made changes.  If you're going to redistribute the code, we require
that you make it clear that the code was descended from Apple sample
code, but that you've made changes.
*)

property ChooseFolderPrompt : "Select folder(s) to remove folder actions from "
property ChooseScriptPrompt : "Select script(s) to remove from "
property NoFoldersActionsExist : "There are no folder actions."

tell application "System Events" to ¬
	set FolderActionNames to name of every folder action

if FolderActionNames is not {} then
	set ChosenFolders to choose from list FolderActionNames ¬
		with prompt ChooseFolderPrompt with multiple selections allowed
	
	if class of ChosenFolders is boolean then
		--user chose no folders
	else
		repeat with EachFolder in ChosenFolders
			set FolderActionName to contents of EachFolder
			tell application "System Events" to ¬
				set FAScripts to name of every script of folder action FolderActionName
			set ChosenScripts to choose from list FAScripts ¬
				with prompt ChooseScriptPrompt & EachFolder with multiple selections allowed
			
			if class of ChosenScripts is boolean then
				--user chose no scripts, skip this folder action
			else
				repeat with EachScript in ChosenScripts
					set ScriptName to contents of EachScript
					tell application "System Events" to ¬
						delete script ScriptName of folder action FolderActionName
				end repeat
				
				--If we deleted all the scripts, delete the folder action object as well
				if (count of FAScripts) is (count of ChosenScripts) then ¬
					tell application "System Events" to ¬
						delete folder action FolderActionName
			end if
		end repeat
	end if
else
	activate
	display dialog NoFoldersActionsExist with icon note
end if

