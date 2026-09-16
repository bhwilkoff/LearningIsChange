---
title: "Let the Google Classroom and Doctopus integration begin!"
date: 2014-09-13
url: https://learningischange.com/2014/09/13/let-the-google-classroom-and-doctopus-integration-begin/
author: Ben Wilkoff
categories: ["Ben Wilkoff"]
tags: ["Ben Wilkoff"]
---

# Let the Google Classroom and Doctopus integration begin!

![](https://i0.wp.com/learningischange.com/wp-content/uploads/2014/09/integrating-classroom.png?w=1225)

Let the Google Classroom and Doctopus integration begin!

Jessica Raleigh, Peter Douglas, and Candace Mcgregor?

Originally shared by Andrew Stillman (Personal)

Google Classroom users.  Looking to benefit from the popular Goobric extension (rubric) grading fed to a spreadsheet right from your browser?  Want the ability to send merged emails to students providing them personalized feedback on their assignments?  Look no further;)  Doctopus now offers rudimentary integration to make these important Doctopus features available for Google Classroom assignments.

Big thanks to Jennifer Magiera Ziggy Dziegman Ann Lemmer Alice Keeler Renee Henderson Stacie Ryan C. Tondreau Justin Brink and others for beta testing and offering feedback.

Though there are not yet any available APIs for Classroom per-se, I was able to use the Google Drive APIs to get a “light” integration of Doctopus / Goobric to work with Google Classroom assignments.  Looking forward to taking this even further once the Classroom team gets some APIs out the door!

Here’s what the integration does at present:

A) Auto-discovers whether the Doctopus user has any Google Classroom classes and offers an additional option in Step 1 of setup called “–Ingest Google CR Assignment.”

B) Lets the user select from CR classes, and then assignments within the selected class.  It discovers these from Drive, so it can only find files for students that are actually available in that folder in Drive.  This means that students who haven’t started the assignment will not have their files listed…

C) Pulls these Classroom submissions into a Doctopus sheet and queues them up for use with “Refresh last edit,” “Attach Goobric” and “Send feedback email” tools that Doctopus users are used to.  No student folder keys are pulled in because these student folders are not made viewable to the teacher in Classroom.  “Look for new submissions” button allows teacher to pull in any student files that may have been launched after step 1 was originally performed.﻿

Owing to the lack of APIs, here’s what the integration doesn’t do:

1) Touch sharing privileges on any of the files in Classroom.

2) Can’t see student assignments that haven’t been launched from a template or standalone (non-template) Drive files that haven’t yet submitted.

3) Doesn’t submit rubric scores back into Google Classroom.  Instead, scores go to Doctopus spreadsheet.

4) Doesn’t “return” the assignment to the student – e.g. emails student rubric score but doesn’t transfer ownership back to student or change their assignment status in Google Classroom.
