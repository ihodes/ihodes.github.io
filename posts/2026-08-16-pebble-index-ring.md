---
layout: post
title: Fun with the Pebble Index 01 smart ring
subtitle:
summary:
categories: hardware
date: 2026-08-16
---

A small smart ring to discretely dictate notes, with 2 years of battery life, and phone-local transcription for $75 was enough to pique my interest. The [Pebble Index 01](https://repebble.com/index) is a remarkable device, if a bit less than beautiful: I recently had someone ask why I was wearing a zip-tie on my finger, and that was in San Francisco. But what makes it more remarkable—other than it just working, as described above—are some of the powerful and simple features that are built on top of this basic foundation.

The iOS app (I believe the Android app more capable) includes several features that allow for limitless personalization. Two of the more interesting ones to me at this point are:

- A webhook that you can dispatch both the transcript and the raw recording to
- A MCP server integration, which the local agent (or a cloud agent, if needed) can use

With the help of a coding LLM, the simplicity of https://exe.dev, a local managed daemon, and 30 minutes of time, I've built an integration that processes notes and adds them to Things.app and a markdown logfile.

There are so many possibilities from here, up to even driving an agent fleet via voice, whispering into your finger (it only works 5-20cm away from your hand), like a real weirdo.
