---
title: "Alright, I have definitely been trying to figure this out for the last hour or so, and I would really like to move…"
date: 2015-03-20
url: https://learningischange.com/2015/03/20/alright-i-have-definitely-been-trying-to-figure-this-out-for-the-last-hour-or-so-and-i-would-really-like-to-move/
author: Ben Wilkoff
categories: ["Ben Wilkoff"]
tags: ["Ben Wilkoff"]
---

# Alright, I have definitely been trying to figure this out for the last hour or so, and I would really like to move…

Alright, I have definitely been trying to figure this out for the last hour or so, and I would really like to move on to a different problem. Any help would be most appreciated.

I’m trying to create a function that I can run “on form submit” that will create a new google drive folder. I would like the folder id to be populated into a column within the spreadsheet so that I can then use Autocrat to create documents within the folder (also upon form submit). Ideally, this function would also check to see if the folder with that name already exists and would not create it but rather put the Folder ID of the already created folder within the cell so that someone who fills out the form for the first time gets a new folder, but someone who is filling the form out for the second or third time would still use the same folder (although, the error logic I am describing is not a requirement).

I found this code snippet (in the answer) that I was able to play around with here: [http://stackoverflow.com/questions/16460425/make-folders-from-spreadsheet-data-in-google-drive](http://stackoverflow.com/questions/16460425/make-folders-from-spreadsheet-data-in-google-drive)

The only things that needed to be changed were moving from DocList to DriveApp and changing GetFolder to GetFoldersByName. If anyone has done anything like this or would like to take a stab, I would love it!

http://stackoverflow.com/questions/16460425/make-folders-from-spreadsheet-data-in-google-drive
