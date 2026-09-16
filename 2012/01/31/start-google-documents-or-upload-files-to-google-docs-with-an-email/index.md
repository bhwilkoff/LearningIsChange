---
title: "Start Google Documents or Upload Files to Google Docs with an email."
date: 2012-01-31
url: https://learningischange.com/2012/01/31/start-google-documents-or-upload-files-to-google-docs-with-an-email/
author: Ben Wilkoff
categories: ["Blog"]
tags: []
---

# Start Google Documents or Upload Files to Google Docs with an email.

Google decided that emailing to start a Google Doc wasn’t a service that enough people were using, so they discontinued it sometime in 2009. While I didn’t use it all of the time, I found it incredibly useful. And ever since, I have been looking for a way to do the following:

- Start a Google Document with the text of an email I send
- Start a Google Document by attaching a Powerpoint, Excel, or Word Doc.
- Have anyone upload to my Google Documents in a predesignated folder

Well, now all of these things are easily within my grasp and I am basking in the glow of this productivity hack. While you may not be as excited about it as I am, here is how you might want to use it:

- To turn in files (from anyone in a meeting or in your classroom) to you in a well organized folder with a time stamp
- To share files with a group of people in a Google Docs collection simply by emailing them to a single email address (and not having to remember all of the emails of the people that should have it)
- To start a collaborative document on your phone by sending an email (that you can continue to edit when you get back to your computer)
- To upload files that you need to have access to in the cloud.
- To CC google docs on conversations that you would like to continue in a more collaborative way than just emailing back and forth.

I’m sure that you can think of a few other ways of using it, but let’s get to the steps for making this happen.

#### Step 1: Log in to [http://sendtodropbox.com](http://sendtodropbox.com/) by giving the application access to your Dropbox account.

What this will do is give you a single email address that you (and anyone else who you want to have access) will use to upload document (first to Dropbox and then to Google Docs).

Some tips: To keep the next steps as simple as possible, keep the file structure as just Attachments / Filename.

#### Step 2: Check “Include HTML copy of email message” in Send to Dropbox

This will take whatever is in the body of your email message and create a file in your Dropbox account in the Attachments folder. Make sure you click “Save Settings” after you check the box.

It looks like this:

![Send To Dropbox  Email files to your Dropbox](/wp-content/uploads/2012/01/Send-To-Dropbox-Email-files-to-your-Dropbox.jpg)

#### Step 3: Send a test email to the email address that Send to Dropbox gave you

You can choose to attach a file or not. It will create the Attachments folder in your Dropbox account and it will allow you to use it in the next step.

#### Step 4: Log into [http://wappwolf.com/dropboxautomator](http://wappwolf.com/dropboxautomator) by giving the application access to your dropbox account.

This is what will take the files from your dropbox folder and upload them to a Google Docs collection. **The question most of you are asking is why not just leave them in Dropbox and be done with it. The answer is that you can’t share the Attachments folder that the Send To Dropbox application makes for you. This limits your ability to leverage the files in that folder (for collaboration and editing purposes).**

#### **Step 5: Click “Create a new automation” in Dropbox Automator**

The Automator is going to watch a folder for new files. The folder you want to select is the “Attachments” folder that was created by Send to Dropbox.

It looks like this:

![Choose a folder you want to automate](/wp-content/uploads/2012/01/Choose-a-folder-you-want-to-automate.jpg)

#### Step 6: Choose “Upload to Google Docs” as the action in the Automation you are creating

If this is your first time setting it up, it will ask you to connect your Google Docs to Dropbox Automator as well. After you do that, it will ask you which folder/collection to put the files in. Choose a folder that you would like to be the “inbox” for these types of files and documents.

Make sure you click “Add Action” when you are done with selecting the collection in Google Docs.

Tips: You can also have the Automator do lots of different things to those files in addition to uploading them to Google Docs, including sending them to a Kindle, emailing them to someone else, saving them to another dropbox folder and a bunch of others. Play around with these because your workflow may be more interesting than the one I have envisioned for my tiny purpose.

It looks like this:

![Choose an action](/wp-content/uploads/2012/01/Choose-an-action.jpg)

#### Step 7: After you are done adding actions, click “Finished” at the top of the page

It looks like this:

![Choose an action 1](/wp-content/uploads/2012/01/Choose-an-action-1.jpg)

**That’s it!**

Now if you (or anyone else) emails that Send to Dropbox Address, the attached files and the email itself will be sent first to Dropbox and then in about 10 minutes get picked up and uploaded to the collection of your choosing in Google Docs. Any files that are “Google Docs Types” will be converted for instant editing and they will be made available to anyone you have shared that folder with. Enjoy.

#### Extra Credit:

If you want to know who sent the files, you can choose to have Send to Dropbox put in a “From Address” in the path in Dropbox. While this makes it easier to know who “turned something in”, you will have to make an automation for each one of the folders in Dropbox Automator in order to have those files moved over into Google Docs. If you are getting things from the same set of people (a classroom or a team, for example, it may be worth the effort).

Also, let me know if you figure out anything cool to do with this hack. I am super excited about how easy it is to automate this process, but I think there is a lot more that we can do with it.
