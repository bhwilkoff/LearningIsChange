---
title: "New script from the same guy who created autocrat and formmule."
date: 2013-11-21
url: https://learningischange.com/2013/11/21/new-script-from-the-same-guy-who-created-autocrat-and-formmule/
author: Ben Wilkoff
categories: ["Ben Wilkoff"]
tags: ["Ben Wilkoff"]
---

# New script from the same guy who created autocrat and formmule.

![](/wp-content/uploads/2013/11/tallyHo_icon.gif)

New script from the same guy who created autocrat and formmule.

Originally shared by Andrew Stillman (Personal)

After some debugging help from this community, the tallyHo script is now in the gallery.  Jolly good hunting everyone!

See documentation at: [http://cloudlab.newvisions.org/tallyho](http://cloudlab.newvisions.org/tallyho)

What does it do, exactly?

It’s a poor-man’s multi-conditional COUNTIF (e.g. COUNTIFS — not possible in G-Sheets), which is frequently accomplished via =COUNTA(IFERROR(FILTER()) or a =COUNTA(QUERY()).  The key advantages with tallyHo over these formulas are: simplicity, reduced Spreadsheet complexity, and the ability to reach across spreadsheets to tally values without pushing data between them.

Description not so helpful for the spreadsheet newbie, eh?  What each of those formulas above does is count the number of occurrences of a matching  criterion plus some additional criteria.

Examples:

I want to count the total number of form submissions in another spreadssheet that match a particular username with a date greater than 7 days ago.

I want to tally the number of absences for a particular student (matching student ID) in the past 10 school days and in the past 20 school days.

I want to count the number of courses with an average below 65 for each student in my school, using a data dump from our eGradebook solution imported weekly into another Google Sheet in Drive.
