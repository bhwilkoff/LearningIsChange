---
title: "Desktop Virtualization for the iPad!"
date: 2010-05-05
url: https://learningischange.com/2010/05/05/desktop-virtualization-for-the-ipad/
author: Ben Wilkoff
categories: ["Uncategorized"]
tags: []
---

# Desktop Virtualization for the iPad!

I think one of the things that most intrigued me about the ipad was that It might actually be able to replace a computer running windows or [OSX](http://apple.com/macosx/) by utilizing virtualization. While there is something to be said for [Citrix](http://www.citrix.com/) and their line of remote management products, I wanted to do this for free. And not only that, I wanted to be able to do this virtualization for a number ipads all logged in to the desktop operating system from a single laptop or desktop machine.

Well, without realizing that I would solve this question so quickly after procuring my own [iPad](http://www.apple.com/ipad/), there is a relatively simple way to do software virtualization for about 9 ipads/iPod touches/iphones, all for free. Here it is, step by step:

1. Turn on fast-user switching. This will allow the iPad to connect to an account other than the one that is being used by the computer itself. To do this, go into System Preferences, click on Accounts, Click on Login Options, then check the box to enable fast-user switching:

[![System Preferences](https://i0.wp.com/img.skitch.com/20100505-cqjk8nmyuq1ca2aebhjxgg63u.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnb9/system-preferences)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

[![Accounts](https://i0.wp.com/img.skitch.com/20100505-gubdjwbxsc8uj3iq1yd8t82dbp.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnng/accounts)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

[![Skitch](https://i0.wp.com/img.skitch.com/20100505-ca6dta72kqqmasu7959sdpyuw9.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnnt/skitch)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

2. Create as many accounts as you would like to use for virtualization. Click the plus sign within the accounts window to do this:

[![Skitch](https://i0.wp.com/img.skitch.com/20100505-m39bdpwuyfgmgi2wxtyutt1u85.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnqy/skitch)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

3. Download Vine [VNC](http://en.wikipedia.org/wiki/Virtual_Network_Computing) Server from http://sourceforge.net/projects/osxvnc/
4. Open up the program you just downloaded and go into the preferences. From within the preferences, set up your first display on your current OSX account (the one you normally use). This will set up your VNC server for that port to only look at that account. You will see why that matters in a bit. You will also need to choose a password to allow access to your screen:

[![Apple](https://i0.wp.com/img.skitch.com/20100505-t42c4pnhjueg2qxprbrd1w73f9.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnqw/apple)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

[![Vine Server Preferences](https://i0.wp.com/img.skitch.com/20100505-d6y8irxg7732h8mim4fp1id52m.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnti/vine-server-preferences)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

5. Log in to one of your other accounts via the fast-user-switching. And Open up Vine Server program in that account. Then go into preferences and set up the second display. (repeat this step for as many virtualizations as you would like):

[![SystemUIServer](https://i0.wp.com/img.skitch.com/20100505-n4wujqcewu8wj1i482dfqwykpp.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnn1p/systemuiserver)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

[![Picture 2-1](https://i0.wp.com/img.skitch.com/20100505-kg36rm7tccrcykn277figuqmk5.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnnad/picture-2-1)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

6. Download VNC Lite on your iPod Touch/iPhone/iPad (http://itunes.apple.com/us/app/mocha-vnc-lite/id284984448?mt=8) and open it up. It should look like this:

[![photo](https://i0.wp.com/img.skitch.com/20100505-ksgi6grw7dt6hdn1xanftubddu.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnn22/photo)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

7. Click Menu and then Edit Connections. Add two connections (to start, but you can add as many virtualized connections as you want). Both should have the same VNC address (your computer name on the network), but one should have 5901 and one should have 5902 in the port area. This will tell the VNC client which user to log into. You will also need to put in the passwords that you set for the vine servers:

[![photo-1](https://i0.wp.com/img.skitch.com/20100505-x8cxr8qpwadutsu3c2nhdr6i7h.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnn3d/photo-1)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

8: Connect to one of the two connections that you just set up. If you have done everything correctly, you should be able to connect to your computer from the two accounts. Enjoy:

[![photo-3](https://i0.wp.com/img.skitch.com/20100505-g7d6y9w6by82c2hi91jtumr7ep.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnn3i/photo-3)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

[![photo-2](https://i0.wp.com/img.skitch.com/20100505-nu9m3p49pkdqd3sn4urgi3gup4.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnn3p/photo-2)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

[![photo-4](https://i0.wp.com/img.skitch.com/20100505-nsddsrcpgxnbtqs5kpnajuibs7.preview.jpg?w=1225)](http://skitch.com/bhwilkoff/dnn3a/photo-4)
Uploaded with [plasq](http://plasq.com/)‘s [Skitch](http://skitch.com/)!

Now aside from this being really cool, I can think of a good number of reasons why this matters. I would like to start seeing people use mobile devices as desktop and laptop replacements both for the economic value as well as the ability to put more power in the hands of students, collaborators, and creators. I would also like to see just how efficient we can get at using the technology we have in the room before we start adding a whole bunch of requirements for 1:1 laptops in any situation. I’m interested to see where this goes. Let me know if you come up with anything great.

###### Related articles by Zemanta

- [When It Comes to Virtualization, Are We There Yet?](http://gigaom.com/2010/04/19/when-it-comes-to-virtualization-are-we-there-yet/) (gigaom.com)
- [First iPad Annoyance-File Sharing](http://www.chrisbrogan.com/first-ipad-annoyance-file-sharing/) (chrisbrogan.com)
- [Hands-on with iPad VNC clients](http://www.tuaw.com/2010/05/03/hands-on-with-ipad-vnc-clients/) (tuaw.com)
- [Using A Macbook From An iPad With iTeleport](http://www.macstories.net/ipad/iteleport/) (macstories.net)
- [Behold! OSX on iPad! With Flash!](http://www.boingboing.net/2010/04/03/behold-osx-on-ipad-w.html) (boingboing.net)

[![Reblog this post [with Zemanta]](https://i0.wp.com/img.zemanta.com/reblog_e.png?w=1225)](http://reblog.zemanta.com/zemified/2b56f539-de1b-40cf-8940-51d63603bcf7/)
