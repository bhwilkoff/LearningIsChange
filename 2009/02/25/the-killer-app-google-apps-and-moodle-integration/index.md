---
title: "The Killer App: Google Apps and Moodle Integration?"
date: 2009-02-25
url: https://learningischange.com/2009/02/25/the-killer-app-google-apps-and-moodle-integration/
author: Ben Wilkoff
categories: ["Uncategorized"]
tags: []
---

# The Killer App: Google Apps and Moodle Integration?

[![Moodle](http://upload.wikimedia.org/wikipedia/en/thumb/3/34/Moodle_1.3_sample_course_screengrab.png/202px-Moodle_1.3_sample_course_screengrab.png)](http://en.wikipedia.org/wiki/Image:Moodle_1.3_sample_course_screengrab.png) *Image via Wikipedia*

Even though I haven’t used [Moodle](http://moodle.org/) as much as WordPress and Wikispaces in my own teaching and learning, I have installed it enough times to know what it does well and what it does not do so well.

Moodle does a very good job of monitoring students, giving assessments/grades, providing content, and doing discussion forums. It does not do a very good job of synchronous collaboration, wikis, email, or any of the other things that [Google](http://google.com/) Apps does an amazing job at. I guess that is why Moodlerooms decided that it would be a great idea to get the two projects together and create an easy way to do single-sign-on.

I am amazed at the potential for something like this. Imagine being able to log into your classes, your e-mail, your sites, and your docs all at one place. Well, after much working on my own installation, I would like to provide a simple how to for making this process happen in your Moodle instance:

Step 1: [Download Moode-Google Integration “plugin”](http://moodle-google.googlecode.com/files/google.zip)

Step 2: Unzip the files into your moodle installation.

Step 3: [Follow these instructions for the moodle side:](http://development.moodlerooms.com/course/view.php?id=30)

> - Login to Moodle as an Administrator - Click Notifications to update block tables - In the Site Admin menu, select Users. Next, select Authentication and click Google Authentication. - Enter your Google partner page domain name.

Step 4: Create the Private and Public Keys for Moodle and Google Apps

> Open up Terminal and enter in the following two strings: - ``` openssl genrsa -out rsaprivkey.pem 1024 ``` - openssl req -new -x509 -key rsaprivkey.pem -out rsacert.pem

> The first command creates the private key that is stored only on Moodle and the second command creates the public key that is stored on both Moodle and Google Apps.

Step 5:

- Upload Private Key (rsaprivkey.pem) (if you don’t have access to Terminal, visit [Google Documenation Regarding Key Generation](http://code.google.com/apis/apps/articles/sso-keygen.html)) to Moodle

- Upload the SSL Signing Certificate (rsacert.pem) (again, if you don’t have access to Terminal, [Google Documenation Regarding Key Generation](http://code.google.com/apis/apps/articles/sso-keygen.html) ) to Moodle

Step 6:

- In a new window open Google Apps Control Panel page as admin (http://google.com/a/yourdomain.com)
- Click the **Advanced tools** tab.
- Click the **Set up single sign-on ([SSO](http://en.wikipedia.org/wiki/Single_sign-on))** link next to Authentication.
- First check the **Enable Single Sign-on** box.
- Now insert this url into the **Sign-in page URL** text field.
**http://YourMoodleDirectory/login/index.php**
- Insert this url into the **Sign-out page URL** text field.
**http://YourMoodleDirectory/login/logout.php**
- Insert this url into the **Change password URL** text field.
**http://YourMoodleDirectory/login/change_password.php**
- Upload the **Verification certificate to Google (X.509 certificate containing the public key). This is the**rsacert.pem file that you uploaded to Moodle already.

Step 7:

- Click the User Accounts tab in Google Apps.

- This displays existing users as well as a message that says “You can create up to ### user accounts for this domain” If you are using the Google User Sync block for account management, this number must match the number of accounts you plan on creating. Request more accounts if you need them by clicking the “request more” link on this page.
- Click the Settings link. Check the box to Enable provisioning API (otherwise users will NOT be updated).

- Click Save Changes.
- Click on Advanced tools in Google Apps one more time
- Click on “Manage [OAuth](http://en.wikipedia.org/wiki/OAuth) Access”
- Upload your **(X.509 certificate containing the public key) here too. This is the**rsacert.pem file that you uploaded to Moodle already.
- Then copy to your clipboard (Control+C/Apple+C) the OAuth consumer secret

Step 8 (in order to get [Gmail](http://gmail.com/) to fully talk with Moodle):

- Enable all of the google blocks in your Moodle Instance by logging in as an admin and then adding them to the front page.
- Open up the blocks admin (under modules) and click on the Gmail block.
- Paste the OAuth Consumer secret into the field that asks for it.
- Click Save Changes
- Click on the Google User Sync block in the blocks admin menu.
- Fill out your admin information for Google Apps

I think that is pretty much it. Once I did all of those things, I was able to create users in Moodle and have them transfer over to Google Apps. I was able to log into docs, sites, gmail, etc directly from the Google Apps block in Moodle.

As excited as I am that I was actually able to get it to work, I am more excited for the possiblity of stopping the excuses that many people have in either not implimenting a LMS because it doesn’t have a collaborative suite built in or not implimenting Google Apps because it doesn’t work within their LMS. I would like to get to a point where people only are talking about the learning possibilities, not the pitfalls of the technology.

(Also, let me know if I have screwed up in any way on this how-to. I would post it on a wiki for others to make it better, but since I don’t know where the Moodle wikis are, I will wait until someone illuminates me.)

[![Reblog this post [with Zemanta]](https://i0.wp.com/img.zemanta.com/reblog_e.png?w=1225)](http://reblog.zemanta.com/zemified/f728deb5-10c7-41eb-bf46-723dfd4a706e/)

### Author: **Ben Wilkoff**

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=80&d=mm&r=g)

He owns a typewriter and collects Laserdiscs. He loves his three children quite a bit (aged 11, 16 and 18). He is passionate about authentic learning, technology with purpose, and creating at least one new thing every day. In short, he teaches, and learns. A lot.  [View all posts by Ben Wilkoff →](/author/bhwilkoff/)

[A coalition of the willing: Online Learning in Colorado](/2009/02/24/a-coalition-of-the-willing-online-learning-in-colorado/)

[Laying down the gauntlet…](/2009/02/26/laying-down-the-gauntlet/)

### 70 Comments

-    ![](https://secure.gravatar.com/avatar/9975647b24cc83270a66898ee199371331a67c2934b47f4ef07b4aba82e6f3b7?s=70&d=mm&r=g)							[Glenn](http://mrmoses.org/)

[February 27, 2009 at 12:53 am 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-395)

Ben, if you don’t already know, I wanted to state for the record that you are one of my favorite people.  Hit me up some time.  I really want to have a conversation about this.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=395#respond)

-    ![](https://secure.gravatar.com/avatar/2eef0ef1b5a4effb4218c23926bbb3b4b12def312cb5237791d78d513a873fbc?s=70&d=mm&r=g)							Jim Lerman

[February 27, 2009 at 4:28 am 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-396)

This is absolutely amazing…if it works, it renders MoodleRooms unnecessary, just load Moodle and off you go. Of course one needs to be able to handle all this, but there are those out there who can! Kudos, Ben, for doing a fabulous public service. I sure hope others will rise to the challenge of uncovering any bugs in this process so that it becomes totally smooth for all!

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=396#respond)

-    ![](https://secure.gravatar.com/avatar/37c7d3d08dbb817bfb0328fa5f135f29e8c58d895b7260233bd604f7de1a7a26?s=70&d=mm&r=g)							[cgaub](http://blogs.everettsd.org/cgau)

[February 28, 2009 at 5:46 pm 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-397)

I just sent this article off to my district IT guy. we already use Moodle district wide and now they have been working on a google docs/apps system for the district… I hope they can put them together! thanks for posting this, although it makes no sense to me, I hope it will make sense for my IT guy.
thanks

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=397#respond)

-    ![](https://secure.gravatar.com/avatar/a2051515c07f3ceeecc810e1f016e12ee11b2a4829e9f83a4943bb0adc52f34e?s=70&d=mm&r=g)							[Michael Penney](http://development.moodlerooms.com/)

[March 1, 2009 at 6:55 pm 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-398)

Just as a note to Jim, the integration doesn’t let you run Moodle <em>on</em> GoogleApps*, it lets you integrate Moodle with GoogleApps – with Moodle as the source of user accounts in GoogleApps.

Hopefully it doesn’t render Moodlerooms unnecessary or we won’t be able to keep developing and releasing things like this;-).**

*Running Moodle on the Google Platform would be a great deal of work, as Google’s BigTable database doesn’t support joins, and Moodle uses a great deal of them currently.

** As Moodlerooms is an official Moodle partner, we also do contribute a substantial amount of our revenue back to support the continued development of the Moodle core code.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=398#respond)

-    ![](https://secure.gravatar.com/avatar/9d35304a4a5e8b5f3220397676e90d21e691a1b024556a04c051d6321607ab9b?s=70&d=mm&r=g)							Kevin Brooks

[March 21, 2009 at 4:39 pm 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-399)

Ben,

I, too, would like to talk with you sometime about this integration and how you have used it.  I have used Google Docs quite a bit so it would be amazing if I could integrate it into Moodle. Thanks
Kevin Brooks
Littleton High School

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=399#respond)

-    ![](https://secure.gravatar.com/avatar/ccfaa5639f326f63a989fa350a9d25769df8f3644a19c470445697f7764bb193?s=70&d=mm&r=g)							Dforge

[April 9, 2009 at 5:22 am 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-400)

It all works well, thanks, except the unread mail always says (0).. Am I doing something wrong?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=400#respond)

- Pingback: [Moodlerific.org » Blog Archive » Google Apps + Moodle Integration Struggles](http://www.moodlerific.org/2009/05/04/google-apps-moodle-integration-struggles/)

-    ![](https://secure.gravatar.com/avatar/321b923075994df1028b45de038e10f1eb02cdfba6c14ff10d52b2ff29270b99?s=70&d=mm&r=g)							[Doug Belshaw](http://dougbelshaw.com/blog)

[May 30, 2009 at 6:46 pm 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-402)

Ben, can’t thank you enough for this great guide. Only bit I had to change was the bit r.e. key generation but that was explained on the Google page you linked to!

I’ve managed to get a Moodle installation talking to my existing Google Apps service as a test ([http://twitpic.com/69vjj](http://twitpic.com/69vjj)) so now I can hopefully roll it out to c.3,000 students at the Academy at which I’m Director of E-Learning. 🙂

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=402#respond)

-    ![](https://secure.gravatar.com/avatar/6cd4c47cb3efc01d2f2a244d591ef5bcc3bc3786981e3869259af5635f26d519?s=70&d=mm&r=g)							[Jim Grogan](http://www.newcreek.net/moodle)

[June 5, 2009 at 4:07 pm 17 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-403)

Hey man thanks a lot for this. I followed your instructions and got the integration working perfectly.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=403#respond)

-    ![](https://secure.gravatar.com/avatar/6340dc1e51ccf757f4ffb3c8af277411d329c9ec3d764164c16d79d48f60b24c?s=70&d=mm&r=g)							[Chris Walsh](http://www.infinitethinking.org/)

[June 25, 2009 at 11:40 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-404)

Ben –

This is phenomenal.  Fantastic work.  I’m playing with this for one of my clints, and everything worked seamlessly. If only my Moodle-Mahara integration was going as smoothly!

Kudos for developing it and sharing it with all of us.  If you’re going to be @ NECC, drop me a line, and we can connect.

Chris : )

P.S. As Edutopia’s Totally Wired Teacher for 2007, you might be interested in the Digital Generation Project which I recently helped them launch: [http://www.edutopia.org/digital-generation](http://www.edutopia.org/digital-generation)

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=404#respond)

- Pingback: [Moodlerific.org » Blog Archive » Microsoft Integrates Live@edu with Moodle](http://www.moodlerific.org/2009/07/23/microsoft-integrates-liveedu-with-moodle/)

-    ![](https://secure.gravatar.com/avatar/f29f7113747004a676ab73e5a1e2694adb6ea1174415d008bef96fa3bf1d01e8?s=70&d=mm&r=g)							[Sharon Betts](http://sharonsshare.blogspot.com/)

[August 8, 2009 at 4:50 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-406)

Thank you for the clear directions – I just finished implementing a Wikispaces / Moodle SSO integration and am now working on getting this as the next step.  Your easy to understand steps are so valuable.
If only blogger was included with educational google apps.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=406#respond)

-    ![](https://secure.gravatar.com/avatar/c406d999410da4f97dbef7546343f78b3a982b273da79c5ae71acc90bdbcae0d?s=70&d=mm&r=g)							John Easo

[August 15, 2009 at 6:48 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-407)

There is another very useful tool that does better for student monitoring, content management and also very good synchronous collaboration with other students in real time.  Take a look at [flash cards](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/www.funnelbrain.com)on this site and also the concept of student ‘funnel’ and concurrent changes to flashcards!  I have used this and found it to be very useful with my students.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=407#respond)

-    ![](https://secure.gravatar.com/avatar/221e5a3b4f245f756f2f5482dd07cfcb144a0ffe4d8ed284c0fd7f32b69e4e7e?s=70&d=mm&r=g)							[Roque Castillo](http://born2learn.moodlehub.com/)

[September 2, 2009 at 6:14 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-408)

Hello Ben,

I was trying to access this site ( [http://code.google.com/apis/apps/articles/sso-keygen.html](http://code.google.com/apis/apps/articles/sso-keygen.html)) but it results in error. I searched a lot to find some clues on how to obtain the Private and Public Keys for Moodle and Google Apps. Finally I stopped by this site: [http://moodle.eustaceisd.net/mod/wiki/view.php?id=1101&page=Create+RSA+Key+and+SSL+Certificate+for+Moodle+and+Google](http://moodle.eustaceisd.net/mod/wiki/view.php?id=1101&page=Create+RSA+Key+and+SSL+Certificate+for+Moodle+and+Google)
Would you so kind to update the information, so other people reading your awesome instruction won’t have any problems ?
Thank you

Roque

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=408#respond)

-    ![](https://secure.gravatar.com/avatar/221e5a3b4f245f756f2f5482dd07cfcb144a0ffe4d8ed284c0fd7f32b69e4e7e?s=70&d=mm&r=g)							[Roque Castillo](http://born2learn.moodlehub.com/)

[September 2, 2009 at 6:18 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-409)

Sorry, the site is : [http://moodle.eustaceisd.net/mod/wiki/view.php?id=1101&page=Create+RSA+Key+and+SSL+Certificate+for+Moodle+and+Google](http://moodle.eustaceisd.net/mod/wiki/view.php?id=1101&page=Create+RSA+Key+and+SSL+Certificate+for+Moodle+and+Google).

Roque

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=409#respond)

- Pingback: [Moodle, Mahara, Google Apps and SSO « Adrian Taylor](http://ajtaylor.wordpress.com/2009/09/30/moodle-mahara-google-apps-and-sso/)

-    ![](https://secure.gravatar.com/avatar/ed4ecc2d896dc84afac312a1b732e501daeffd84204285c57cf6e0aa7df7fb4b?s=70&d=mm&r=g)							Dave Sweigert

[October 1, 2009 at 3:26 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-411)

Your directions were great.  This is exactly what we needed to get the password piece of our LDAP integration working with Google Apps.  Two things I’d like to point out or ask though.
First – Now that I have made the changes, when my users log off our Moodle server they go to a new URL ([http://moodle.wssd.k12.pa.us/login/logout.php?sesskey=fNFykG7nS4](http://moodle.wssd.k12.pa.us/login/logout.php?sesskey=fNFykG7nS4)) and it comes up as an error (Internet Explorer cannot display the webpage) unless you refresh the page then you are out logged out of the Moodle site.  Has anyone else seen this?  Am I doing something wrong?
Second – I have some users who have usernames that are split with a space (like john doe) and the sync-cmd in Google Apps does not like them and now that I have done SSO, neither does Moodle.  I can change these few users to a different username but is this normal behavior too?
Thanks again for documenting this.  It really helped.
-Dave

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=411#respond)

-    ![](https://secure.gravatar.com/avatar/ed4ecc2d896dc84afac312a1b732e501daeffd84204285c57cf6e0aa7df7fb4b?s=70&d=mm&r=g)							Dave Sweigert

[October 13, 2009 at 2:58 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-412)

The above situation was being caused by our web content filter prohibiting access to mail.google.com.  Once we got that straightened out, we were OK.  And yes our users cannot have spaces in their names, so we are in the process of fixing these too.  Thanks for your help.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=412#respond)

- Pingback: [m-Learning » Google Apps y Moodle](http://blogs.eoi.es/blogs/mlearning/google-apps-y-moodle/)

-    ![](https://secure.gravatar.com/avatar/24fa0606db990f4dd380feca439a998e778359c8caca01549dee4bc0346095dd?s=70&d=mm&r=g)							Chris

[October 20, 2009 at 12:20 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-414)

Wow this great. Thanks.
Is it possible for me to use this plug for two separate Google Ed Apps. We hold and host two different domains for Google Ed App. One is for our teachers and one for our students. This allows another layer of control for our tech department and staff. Both groups use the Moodle platform to log in. So I was hoping to be able to have two separate blocks. One for students, one for teachers.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=414#respond)

-    ![](https://secure.gravatar.com/avatar/d23235db32dd2a6d7460afcc55466518e1bab5a681bc1fa9852eda862c3c65e4?s=70&d=mm&r=g)							Wheelie

[October 20, 2009 at 8:01 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-415)

If anybody else is having an issue with the unread mail count always reading (0), I found that in the Gmail Settings in my site Modules-Blocks-Gmail that the OAuth Consumer Secret had a space at the end of it i.e. jhjhhuhuh788 . (obviously the . is to represent where my key ended, it should have ended after the last 8). When removed and changes saved, hey presto unread emails showed up. Hope this helps anyone.

Wheelie

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=415#respond)

-    ![](https://secure.gravatar.com/avatar/a28044be69276a13ad9d3fbb57d848cec7afa4e869eb6b185718518a7166fe08?s=70&d=mm&r=g)							Estevan Veenstra

[October 22, 2009 at 10:16 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-416)

I would so like to have access to terminal, but to be honest I don’t know what it is?

Or could somebody help get to the commandline so that I can generate the public and private keys for integration between moodle and google..

Thanks in advance,,

Estevan

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=416#respond)

-    ![](https://secure.gravatar.com/avatar/2385fe09a957bb229b58596addb844279b33f37f3a651d3f40ff90b3492fce26?s=70&d=mm&r=g)							Bill Willis

[October 25, 2009 at 12:39 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-417)

I’d love to implement this, but I have one question:

I already have 1200 users on my Google domain. If a user is on the Google Domain, but not in the Moodle user database, will they be eliminated from Google?

Bill

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=417#respond)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							Ben Wilkoff

[October 26, 2009 at 7:08 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-418)

@Bill All you would need to do is download all of the users from your gApps domain as a CSV and then upload them to your moodle. This would make sure that no accounts get “erased”. You can also not turn on that option, meaning that Moodle will be used for authentication, but it will not sync the databases. Let me know if you have any questions about that.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=418#respond)

-    ![](https://secure.gravatar.com/avatar/2385fe09a957bb229b58596addb844279b33f37f3a651d3f40ff90b3492fce26?s=70&d=mm&r=g)							Bill Willis

[October 27, 2009 at 6:08 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-419)

Thanks Ben. It is working great. Still in our testing phase, but the ga-moodle is a great marriage.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=419#respond)

- Pingback: [Moodle eingeführt « Ich lerne noch.](http://www.kurzblog.de/?p=7)

-    ![](https://secure.gravatar.com/avatar/31df97b28ed20bc32aab0e2ad487ad6d22edbae119ebbba1ba6b55ce4dded87a?s=70&d=mm&r=g)							Serpil Kilic

[November 9, 2009 at 7:36 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-421)

Ben thank you for your great explanation. I found it out after strugling with Gooogle and Moodle documentations.
One important question. Like Bill I have gApps running with all my users there and just installing Moodle. I have my google accounts in .csv and use Upload users option in Moodle to add all of them. I need to enter passwords for the csv. What do I do for that?
What happens to the students gmail passwords. I did a trial on a few it only works with the new passwords I enter from csv. I have turned on the Google authentication. But still gmail passwords do not work when loggin in. I do not want to tell all the kids that they have a new password. Even if I do I cannot configure in bulk to make them change their passwords when they first enter.
Any advice?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=421#respond)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							Ben Wilkoff

[November 9, 2009 at 9:56 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-422)

@Serpil, Your user’s Google Passwords are no longer in use, but if you were to ever remove the SSO (like we did when our moodle was down for repairs) their passwords in Google Apps would again become active. I don’t think that there is any way to get the passwords from your Google Apps Administration panel, so I would recommend setting all of the passwords in the CSV that you upload to moode to a single thing and then forcing them to reset their passwords to whatever they were using for their gApps password. This is a pretty dumb step, but I don’t really see any way around it.

There is a way to have they force to change passwords upon entering within the CSV. I believe that you can add that as one of the fields, but I would have the check what it is in the Moodle docs. I’ll let you know if I find it.

Let me know what other questions you have, and thanks for commenting.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=422#respond)

-    ![](https://secure.gravatar.com/avatar/31df97b28ed20bc32aab0e2ad487ad6d22edbae119ebbba1ba6b55ce4dded87a?s=70&d=mm&r=g)							[Serpil Kilic](http://www.aci.dreamhosters.com/)

[November 10, 2009 at 2:41 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-423)

Ben, I have worked my way through and have my test site ready. 🙂 Thanks to you!!
In csv for the pasword you should give changeme and when you are uploading you should pick “Select for bulk operations:New User”.
I do not know what this option is for but it worked only with this.
One more question:
My moodle and Google Apps sites used to work very fast before this operation. Now Moodle site is very slow. It might me that I have uploaded 600 users, or I am hosting it on dreamhost servers, oe don’t know what else. I started to think that this was not a good idea.
Any thoughts??

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=423#respond)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							Ben Wilkoff

[November 10, 2009 at 8:24 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-424)

@Serpil

Moodle slows down for a few different reasons (this is not an exhaustive list by any means). One, the server that it is on is not set up to handle the amount of traffic. Two, the database that it is using is not set up to handle the number of entries. I would say that both may be in play in your case. If you are having everyone authenticate through moodle, more people are going to be using it. If you had to upload all of those users, the database is getting larger as a result.

If I had to guess, it would probably be amount of traffic, but you should be able to see just how many people are logging on when and see if there was a difference after you did the SSO. Let me know if there is any other ways I can help. Talk to you soon.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=424#respond)

-    ![](https://secure.gravatar.com/avatar/5b4e03dad5776416fddc69823a9cbfc80c7e69c0a94c496de2e02393f9fd0f34?s=70&d=mm&r=g)							[Martin Kurz](http://www.adolf-reichwein-schule.net/)

[December 5, 2009 at 2:51 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-425)

Thanks for your howto. It is still the best. At the moment, December 2009, there will be a more new software package from November 16th 2009. It can be downloaded directly from MoodleRooms.

Another thing: Google Apps Education has since 2009 no “Partner Start Page” available.  So there is a small mistake in the Google-Block. I have just deleted the line in the code, so everything is now ok.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=425#respond)

-    ![](https://secure.gravatar.com/avatar/312d2b6f21e4bd5136ae50dc580c365fbbef131a73b47b793aae3c547cb4dfcf?s=70&d=mm&r=g)							Johan

[December 11, 2009 at 2:51 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-426)

I followed this guide but the connection from moodle to gmail doesnt work. If i turn on full debugging i get this.

[message:protected] => Could not find private key file [C:MoodleInstaller19servermoodle/auth/gsaml/C:MoodleInstaller19server/moodledata/samlkeys/rsaprivkey.pem] which is needed to sign the authentication response

As you can see i use windows for this installation, the strange thing is that the sync to google works, i have pushed users from moodle to google, but the gmail function is dead.

I can’t sort it out, i have copied the certs to both locations mentioned above.

Anyone have any thoughts of this?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=426#respond)

-    ![](https://secure.gravatar.com/avatar/20ab2094bbed0245c27c26d3988263c4b2ce6dce8621425ca40d5fb270ddb97a?s=70&d=mm&r=g)							alexvarsakopoulos

[February 20, 2010 at 9:29 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-427)

my google apps is hosted at hostmonster and they have a script Moodle 1.9.7.   Would I install the script at [http://www.epikinonia.org](http://www.epikinonia.org/) or [http://epikinonia.org](http://epikinonia.org/). What's the difference?

Another question is 'create a new database? I would assume yes

Do I still have to install the Moodle-Google intergrations plug in someplace or at epikinonia.org? How do I go about installing it there?

thank you!!

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=427#respond)

- Pingback: [Daily Links 02/20/2010 « EduEyeView](http://edueyeview.wordpress.com/2010/02/20/daily-links-02202010/)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							bhwilkoff

[February 22, 2010 at 10:45 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-430)

The www is redundant. You shouldn't ever need it.

If you have Moodle running on your server, all information is in that
database.

You will have to install the Moodle-Google integrations plugin in the moodle
folder. If you have FTP access, you should be able to do it just fine. Just
follow the instructions on the read me file in the Moodle-Google zip file
for installing in the Moodle directory. Let me know if you have any other
questions.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=430#respond)

-    ![](https://secure.gravatar.com/avatar/20ab2094bbed0245c27c26d3988263c4b2ce6dce8621425ca40d5fb270ddb97a?s=70&d=mm&r=g)							alexvarsakopoulos

[February 22, 2010 at 11:40 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-431)

hi,

thank you for responding. I have the standard version of google apps and and it seems it doesn't have some of the features that the moodle-google integration instructions-settings call for in the advanced tools of google apps..

I did all the things that you have suggested in your email such as ftp-ing the moodle-google integration files in the moodle directory of the host(ed) server.
I wonder if I can upgrade to the educational g-apps.

thank you again!

Alex

________________________________

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=431#respond)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							bhwilkoff

[February 22, 2010 at 11:51 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-432)

Absolutely, you should upgrade to the Educational version of Google Apps.
Here is the link to do so:
[http://www.google.com/support/a/bin/request.py](http://www.google.com/support/a/bin/request.py)?…

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=432#respond)

- Pingback: [#Google Apps Integration @bhwilkoff | Moodle Monthly](http://www.moodlemonthly.com/2010/google-apps-integration-bhwilkoff/)

-    ![](https://secure.gravatar.com/avatar/20ab2094bbed0245c27c26d3988263c4b2ce6dce8621425ca40d5fb270ddb97a?s=70&d=mm&r=g)							alexvarsakopoulos

[February 22, 2010 at 1:46 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-433)

thank you. You've been most helpful.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=433#respond)

- Pingback: [Where Diigo this week… (weekly) « Dave Dixon](http://davedixon.org/blogs/2010/02/where-diigo-this-week-weekly-8/)

-    ![](https://secure.gravatar.com/avatar/781aedbf4c28c9a36fc4137b688a2de831d2fa90ed6b8587107d83d51cbc9417?s=70&d=mm&r=g)							Pat

[March 15, 2010 at 6:34 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-435)

À tester?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=435#respond)

-    ![](https://secure.gravatar.com/avatar/e121290b517db0b39bb89e945a6b5ae022ea2410255fb1cf7bd8c3b356769766?s=70&d=mm&r=g)							[Jason](http://onlinephduk.com/)

[April 4, 2010 at 2:13 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-436)

Thanks we've always wanted to try out Moodle, now that Google Apps  can be integrated we might switch from wordpress to moodle.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=436#respond)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[April 5, 2010 at 6:57 am 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-437)

I do think that WordPress and Moodle do drastically different things. What
are you using WordPress for now that you aren't satisfied with?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=437#respond)

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[April 5, 2010 at 1:57 pm 16 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-441)

I do think that WordPress and Moodle do drastically different things. Whatrnare you using WordPress for now that you aren’t satisfied with?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=441#respond)

- Pingback: [Moodle o google? « AlexelA](http://alexela.wordpress.com/2010/05/28/moodle-o-google/)

- Pingback: [Moodle i Google « AlexelA](http://alexela.wordpress.com/2010/06/18/moodle-i-google/)

- Pingback: [links for 2010-08-01 « Mathematics, Learning and Web 2.0](http://colleenyoung.wordpress.com/2010/08/02/links-for-2010-08-01/)

-    ![](https://secure.gravatar.com/avatar/71a67b97842df812feb9d6b55539792b2e178481913f86d772e3c52181782d59?s=70&d=mm&r=g)							Pelletierb

[October 15, 2010 at 11:51 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-442)

Ben I am having the same problem were my new users are not getting created but when they are added in google they sync fine. I was wondering if you ever got yours fixed. You mentioned something about the latest version but I can not find anything newer than May. If I go to sync status I get Google Apps error: Unable to Connect to ssl://www.google.com:443. Error #0: php_network_getaddresses: getaddrinfo failed: Temporary failure in name resolution my last sync was Sept 10

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=442#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[October 18, 2010 at 3:37 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-443)

I haven’t been able to come up with the time to really take a close look.rnThe one from May should be good enough to perform syncs with the new versionrnof the API. I will be looking more into this soon, but let me know if yournwere able to figure it out because uploading the users twice is kind of arnpain.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=443#respond)

![](https://secure.gravatar.com/avatar/71a67b97842df812feb9d6b55539792b2e178481913f86d772e3c52181782d59?s=70&d=mm&r=g)							Pelletierb

[October 19, 2010 at 2:10 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-444)

I fixed the Unable to Connect to ssl://www.google.com:443. Error #0: php_network_getaddresses: getaddrinfo error that was an issue with my server. But my users still do not sync anymore when I go to google user sync I get “Authentication with Google Apps was successful.”  but when I add a new user I get “Invalid Email”. I am still working on it thanks for the update. rn

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=444#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[October 19, 2010 at 2:40 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-445)

Yep. The invalid email will happen until either the SAML handshake is fixedrnwithin settings (which I haven’t had time to figure out) or you upload thernuser into Google Apps (which is what I have been doing in the meantime).rnPlease let me know if you do figure it out. Talk to you soon.rnrnMy profiles: [image: WordPress]  [image:rnLinkedIn]  [image:rnTwitter] [image:rnFlickr]  [image:rnDelicious] [image:rnSlideShare]  [image:rnFacebook] [image:rnGoogle] rnLatest Blog Post: Question 291 of 365: What is the newrnEugenics?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=445#respond)

-    ![](https://secure.gravatar.com/avatar/cf01130e03ac53e172c3ca6b758949073fa6a76acbfda9ff0623ed71df8e0c46?s=70&d=mm&r=g)							Sasha Yin

[November 7, 2010 at 3:46 am 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-446)

Thanks for your guide. I am a foreign language teacher. My school has not set up any course management system yet, I have been using a wikispaces account for my classes. Lately, I have been thinking about installing a wordpress as extension of my class wikis, and even switching from wikispaces to Moodle, but don’t know exactly how to go about it. I wonder if you could comment on the difference between wikispaces, wordpress, and moodle for individual users. Thanks!

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=446#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[November 9, 2010 at 5:59 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-447)

Wikispaces is great for collaborating on one long range project. I generally
set up a new wiki for each unit of study so that the wiki maintains focus.
You can try and do a year long wiki, but it does get unweildy a bit. I love
wordpress for writing from a particular perspective or for things that do
not build upon one another. I have written about 1000 blog posts with
wordpress and I think that it has brought a level of reflection to my
practice that nothing else has. As for Moodle, it is a straight up Learning
Management System. This is for course creation, assessment, and
conversation. If you have a wiki, you may not need Moodle to manage your
content. If you have a Gradebook, you may not need Moodle to manage your
assessments. If you have a portal for your kids to go to and access their
classwork, then you may not need Moodle for the hallways of your your school
or the conversations in your classroom. Moodle is an
incredibly versatile tool, but it isn’t the right tool for everything. I
hope that helps some.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=447#respond)

-    ![](https://secure.gravatar.com/avatar/c571a409ce00cbbcf98c398a88cbcc846825aabd0ec225b7efba57d743e027bd?s=70&d=mm&r=g)							Alan_escribe06

[November 12, 2010 at 1:35 am 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-448)

Hola soy de Peru, esta excelente el tutorial, funciona a la perfeccion, eres un genio man.. Thanks!

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=448#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[November 12, 2010 at 4:45 am 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-449)

De nada.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=449#respond)

-    ![](https://secure.gravatar.com/avatar/?s=70&d=mm&r=g)							[Khalil Amar](http://www.google.com/profiles/khalilamar)

[January 11, 2011 at 10:28 am 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-450)

Please go to [http://code.google.com/p/moodle-google/downloads/list](http://code.google.com/p/moodle-google/downloads/list) to get the most updated zip file / version of the “Moodle-Google” project.  Thanks

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=450#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[January 11, 2011 at 2:43 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-451)

Thanks for the link. This post is due for an update as soon as I get a
chance.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=451#respond)

![](https://secure.gravatar.com/avatar/92767db58ea2cbc52a4e18ed6c60a604ffbc6fb2e73f3f34392cd15a2b5bdb93?s=70&d=mm&r=g)							Jason

[January 12, 2011 at 8:35 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-452)

Hey Ben,

Will this work with Moodle 2.0?

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=452#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[January 12, 2011 at 8:43 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-453)

I am not sure. I am interested in trying it out on 2.0, but none of my
Moodles are ready to go there yet. Perhaps later this year I will try it
out. Let me know if you try it out and find out one way or another.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=453#respond)

![](https://secure.gravatar.com/avatar/1548b7b3c411ebb1ffc17125d09806a36f691b2f5029988191ee2b536e352117?s=70&d=mm&r=g)							Ed

[January 13, 2011 at 1:51 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-454)

Great post, thank you!. I am also curious about having this running with moodle 2.0.

-    ![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[January 13, 2011 at 5:55 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-455)

Will you try it out for us and let us know? Pretty please…

-    ![](https://secure.gravatar.com/avatar/17ee6225f0fdd7e85f7edd61c385452a1a36c4a38aec79c4ed653c61dd3f717d?s=70&d=mm&r=g)							Sivapgv

[March 3, 2011 at 7:25 am 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-460)

thank you so much..

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=460#respond)

-    ![](https://secure.gravatar.com/avatar/?s=70&d=mm&r=g)							[Syamil Mj](http://www.facebook.com/people/Syamil-Mj/748605376)

[January 18, 2011 at 4:14 am 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-456)

This is gem. Thank you

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=456#respond)

-    ![](https://secure.gravatar.com/avatar/b64e96b59ed694bdd132f8b6b5c7bc823ccfa73fa2b5657b4a2f740bc581fca4?s=70&d=mm&r=g)							Bonnie Thurber

[January 18, 2011 at 6:56 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-457)

I have been using this for three years now. I want to know which Moodle Group created it.
Thanks!
[b-thurber@northwestern.edu](mailto:b-thurber@northwestern.edu)

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=457#respond)

![](https://secure.gravatar.com/avatar/0fd696e841c04ee9328d0fe05e15cf1bf82148735d92e72b5684eef4235c9faa?s=70&d=mm&r=g)							[Ben Wilkoff](/blog)

[January 18, 2011 at 7:33 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-458)

I believe it was originally moodlerooms, but it is now an open project on google code.

Ben Wilkoff

Collaborate now: [http://bit.ly/WilkoffDoc](http://bit.ly/WilkoffDoc)

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=458#respond)

-    ![](https://secure.gravatar.com/avatar/b64e96b59ed694bdd132f8b6b5c7bc823ccfa73fa2b5657b4a2f740bc581fca4?s=70&d=mm&r=g)							Bonnie Thurber

[January 18, 2011 at 8:38 pm 15 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-459)

Hello Peter, I have sync set up and I add new users to Moodle and then sync with Google every day. I have a cron job set up that does sync every

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=459#respond)

-    ![](https://secure.gravatar.com/avatar/bd776e978c1a3f0f4906bb2fbe0925039cb6604498e6afe3e16d7ee678092369?s=70&d=mm&r=g)							David Sweigert

[September 23, 2011 at 7:33 pm 14 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-461)

Starting this school year (2011-12) my users have been randomly (but more frequent than I would like) getting the attached error.  It states “Password Not Valid” and this is when attempting to log into Moodle.  We are doing LDAP authentication to our PDC and then using the Moodle-Google plugin for SSO.  We are using the first version of the plug in.
Does anyone think that my issue is my Moodle server (Moodle 1.9.9+ (Build: 20100707)) or should I consider upgrading my plug in or is is Google (did they upgrade something on their end).
Any thoughts appreciated.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=461#respond)

![](https://secure.gravatar.com/avatar/e547bdd7ea698d06a00ed5712a3641be31a20d7446a4d5baed6e0f7de410209f?s=70&d=mm&r=g)							Collinsl

[September 26, 2011 at 7:59 pm 14 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-462)

David,
I am having similar issues and they began about 5 days ago! I can’t tell if it is Google or Moodle

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=462#respond)

![](https://secure.gravatar.com/avatar/bd776e978c1a3f0f4906bb2fbe0925039cb6604498e6afe3e16d7ee678092369?s=70&d=mm&r=g)							David Sweigert

[October 3, 2011 at 6:53 pm 14 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-463)

I posted on the Moodle.org forum today.  Maybe someone will have an idea.  I will let you know if I find anything out.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=463#respond)

-    ![](https://secure.gravatar.com/avatar/27c631af36e26080415ee0ba1ce43f09f0ea36b03924e325a66b5f70fcf320c7?s=70&d=mm&r=g)							[Alexa](http://learningtreeconsulting.com/)

[April 3, 2015 at 1:27 pm 11 years ago](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/#comment-464)

This will integrate Google Apps services with [Moodle](http://learningtreeconsulting.com/). The Moodle administrators can manage google Apps accounts within Moodle and all the Moodle users will be able to access gApps services within Moodle.

[Reply](/2009/02/25/the-killer-app-google-apps-and-moodle-integration/?replytocom=464#respond)
