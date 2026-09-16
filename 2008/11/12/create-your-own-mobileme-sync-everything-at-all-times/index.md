---
title: "Create your own MobileMe (Sync Everything, at all times)."
date: 2008-11-12
url: https://learningischange.com/2008/11/12/create-your-own-mobileme-sync-everything-at-all-times/
author: Ben Wilkoff
categories: ["Uncategorized"]
tags: []
---

# Create your own MobileMe (Sync Everything, at all times).

*An aside: it is too bad that every post I write seems like an attempt to get back into the habit of posting, but I suppose until I start blogging consistently again, that is just how it is going to have to be. I have missed way too many things that I have been thinking about to ever fully catch up, but perhaps I can start anew. Anyway, here are my latest thoughts.*

Before I go into the details of how to sync yourself completely, I want to tell you why I even undertook this idea. Well, our school system uses an extremely proprietary e-mail and calendaring system called [firstclass](http://www.firstclass.com/). Every person that uses firstclass in our schools is locked in to using the firstclass calendar for appointments and things of that nature. But, because I have seen the light of using [Google Calendar (open API, shared calendars, embedding, etc)](http://calendar.google.com/), I refuse. In fact, I was so obsessed with the idea of converging the two that I speant an entire weekend (when I wasn’t having fun with [my family](http://wilkoffblog.com/)) on getting Firstclass to sync with Google Calendar, and then eventually [my new blackberry](http://na.blackberry.com/eng/devices/device-detail.jsp?navId=H0,C201,P463) that the school district provided for me.

So, this is how you sync everything:

Calendars:

![](https://i0.wp.com/img.skitch.com/20081112-qk57c7k634wt9ftcefejhwwnfu.jpg?resize=345%2C380)
Contacts:
![](https://i0.wp.com/img.skitch.com/20081112-xamqqyshy9ja73my6ebbf849y4.jpg?resize=332%2C366)

Now, for the details…

(*Update: I didn’t put this in the initial post, but I think it is worth mentioning that Firstclass does have a way to sync with both [Palm Desktop Software](http://www.firstclass.com/__Help/FOV13-0025B1EE/A220) and [SyncML directly](http://www.firstclass.com/__Help/FOV13-0025B1EE/S048610EE-048610F4), but since my district hasn’t set either of these up, I thought it was important to try and find a better way of doing things… there are also [third party services](http://www.notifycorp.com/imap4_solutions/firstclass/index.htm) that do some of this, but I want a FREE workflow)*

In order to get your first class calendar to talk to anything else, you will need to export it as a iCal file:
![](https://i0.wp.com/img.skitch.com/20081112-qeck3xg3e77h52yj8k6ap23i26.jpg?w=1225)

Now, you may look at this picture and ask, why I wouldn’t just export it as a blackberry file and skip all of the steps in the middle. Well, there are a few reasons. One, if I did this, all of the events would be duplicated every time I exported and imported. Two, because I am on a Mac I do not have any blackberry desktop software to make this sync work.

So, onward we go to iCal. First, you will need to set up your Google Calendar to sync with iCal, using this [handy dandy tutorial from Life Hacker.](http://www.lifehacker.com.au/tips/2008/07/30/how_to_sync_any_desktop_calendar_with_google_calendar-2.html)

Now that you have your Google Calendar set up to sync, simply import into iCal your latest and greatest export from Firstclass:
![](https://i0.wp.com/img.skitch.com/20081112-qtg1buuqciyp2fhq2n74tjwh5r.jpg?w=1225)

Now, if this isn’t your first time doing this, you will end up with a lot of duplicates. If that is the case, just use the [iCal Dupe Deleter.](http://mac.softpedia.com/get/Business/Delete-iCal-Duplicates.shtml)This is also a good tool for deleting duplicates from Google Calendar if you have ever found yourself with too many of one item.

Now, you have synced completely to your Google Calendar and you are ready to sync to your blackberry. Simply point your device to [this address](http://www.google.com/mobile/blackberry/sync.html) and download your over-the-air sync application.

You can now enter an event in Firstclass, iCal, Google Calendar, or on your blackberry and they will sync with one another. Pretty cool, right. But, we are not done. If you would like to have your calendar in an even more universal Format, you can put it on a SyncML server, like [Funambol](http://my.funambol.com/).

All you have to do is download [their blackberry application](https://www.forge.funambol.org/download/) and you can sync to your heart’s content there.

For Contacts:

If you are also looking to sync your contacts, you can simply use your Blackberry or iPod touch to talk to Funambol using their built in programs (search for funambol in the App store, or use the above link to download the blackberry funambol application).

Then you can sync your contacts with the funambol server.

As for your Mac, you can use the [Preference Pane sync.](https://core.forge.funambol.org/ds/viewMessage.do?dsForumId=405&dsMessageId=22551)

This will let you put your contacts on your mac, on the funambol server, or on your blackberry and they will all sync.

*I understand that MobileMe does a lot more than this, but I believe that if we can create a FREE workflow for each one of our teachers, students, and administrators that syncs information to the place that they need it, we will be able to have the conversations that truly matter. We will no longer be stuck trying to find information, it will always be ours. Although you may not geek out at all that I am proposing, I think there are some pretty heavy implications for continuity in the systems that we are creating. If you have figured out any more syncing tricks, please leave a comment and add to the value of our collective research.*
