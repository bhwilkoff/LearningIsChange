---
title: "Backup your entire Flickr account to your hard drive"
date: 2011-07-11
url: https://learningischange.com/2011/07/11/backup-your-entire-flickr-account-to-your-hard-drive/
author: Ben Wilkoff
categories: ["Blog", "Uncategorized"]
tags: []
---

# Backup your entire Flickr account to your hard drive

I looked around for a tool to do this for about an hour last night. This was the best way I found because it can run in the background and if it gets interrupted, it will pick up where it left off. Just open up terminal and run the script.

[dan/hivelogic-flickrtouchr at master – GitHub](https://github.com/dan/hivelogic-flickrtouchr#readme):

> “A Python script to grab all your photos from flickr and dump them into a directory, organized into folders by set name. Original author is Colm MacCárthaigh. Changes include tweaks to download full-size original images and improvements in handling UTF8 file and photoset names. Run it like this: mkdir FlickrBackupFolder python flickrtouchr.py FlickrBackupFolder You’ll be prompted to authorize with Flickr, and then the magic happens.”
