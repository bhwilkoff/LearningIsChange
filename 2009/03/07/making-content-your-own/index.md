---
title: "Making content your own"
date: 2009-03-07
url: https://learningischange.com/2009/03/07/making-content-your-own/
author: Ben Wilkoff
categories: ["Uncategorized"]
tags: []
---

# Making content your own

[![Moodle](http://upload.wikimedia.org/wikipedia/en/thumb/3/34/Moodle_1.3_sample_course_screengrab.png/202px-Moodle_1.3_sample_course_screengrab.png)](http://en.wikipedia.org/wiki/Image:Moodle_1.3_sample_course_screengrab.png) Image via [Wikipedia](http://en.wikipedia.org/wiki/Image:Moodle_1.3_sample_course_screengrab.png)

In order to document just what I am doing with [moodle](http://moodle.org/) to make sure that it is the direction I would like to go in for creating (at least) a portal for our online school and possibly use it as the [Learning Management System](http://en.wikipedia.org/wiki/Learning_management_system) of choice for professional development, I will be writing about a few of the particular paths I am taking.

The one I am interested in right now is displaying content outside of the moodle directly in the moodle page. The reason for this would be because there are a lot of pages that display exactly the right content that I would want to be able to interact with in the moodle installation. These include wiki pages (non-moodle wikis), blog pages (non-moodle blogs), and tons of web resources. The blocks and activities that exist to do this are pretty good (they allow you to link to things, or html pages directly), but they don’t allow you to embed the page directly, making it look like one fluid page.

Well, I was able to find a block to do this and a patch to make sure that I could put blocks in the middle of the page as large content items.

[Here is the block download](http://moodle.org/mod/forum/discuss.php?d=83306)

[Here is the patch download](http://tracker.moodle.org/browse/MDL-6748)

You can see an[embedded google site page at our portal.](http://edcsd.org/login/)

The best thing about this block is that it really makes it look like a part of the page and not just an iFrame of the google site within a moodle. It does, however, do some funky things with links, but I will figure those out.

Just thought I would share how we may be putting it all together. (Not earth shattering, but I do like putting things together.)

[![Reblog this post [with Zemanta]](https://i0.wp.com/img.zemanta.com/reblog_e.png?w=1225)](http://reblog.zemanta.com/zemified/24867e50-aacc-4352-b09b-863f3e8146a3/)
