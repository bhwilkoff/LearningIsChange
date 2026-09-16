---
title: "What I’m Learning: How to limit the number of words in a response to a Google Form question."
date: 2014-10-16
url: https://learningischange.com/2014/10/16/what-im-learning-how-to-limit-the-number-of-words-in-a-response-to-a-google-form-question/
author: Ben Wilkoff
categories: ["Blog", "What I’m Learning", "What I’m Using"]
tags: []
---

# What I’m Learning: How to limit the number of words in a response to a Google Form question.

While you can use the advanced data validation properties of a Google Form question to limit the number of characters in an answer, you will need a regular expression in order to limit the number of words. If you ever have such a need, here it is:

> ^\s*(\S+\s+){1,9}\S*$

This regular expression will limit the response to 10 words. You can change the 1 and the 9 if you want to have different limits on the number of words (the 1 represents the lowest number your question will accept and the 9 represents the highest).

This is what it looks like in a question:

![](/wp-content/uploads/2014/10/2015_InnEdCo_Call_for_Presentations_-_Google_Forms.jpg)
