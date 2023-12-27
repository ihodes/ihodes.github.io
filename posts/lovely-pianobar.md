---
layout: post
title: Lovely Pianobar
summary: Wherein we configure Pianobar to integrate with one's workflow.
categories: hacking
date: 2011-05-29
---
<section>
If you love using Pandora, but really wish they had a command-line (or at least non-Flash) version of the desktop application, this post will make your day. An absolutely wonderful CLI utility called <a href="https://github.com/PromyLOPh/pianobar">pianobar</a> solves this problem for you, and a few more you didn't know you had. Something to note: there are no advertisements when using pianobar; this may be violating Pandora's terms of service. Because I think Pandora is supplying a great service, I pay for the <span>\$</span>3/month Pandora+ membership and would not be hearing advertisements anyway: if this method seems like a great way to listen to music I'd recommend you pay the <span>\$</span>36 too.

<p>This tutorial will only cover setting up this environment on a Mac, though if you're running Linux you should be able to do much of the same using a few different applications in some cases.</p>
</section>

## What You'll Need

With that said, you can build pianobar from source, or use a package manager like <a href="http://mxcl.github.com/homebrew/">brew</a> to install it. Occasionally you need to update pianobar in order to get the newest auth keys. This should not be the difficult step.

You'll also want to install <a href="http://www.alfredapp.com/">Alfred</a> (Alfred deserves a whole post to itself) to get this to work, though you could accomplish similar results with KeyboardMaestro or another application launcher like LaunchBar. In order to do this using Alfred, you'll need to buy the powerpack (basically, an upgrade) for around <span>$</span>20. Any way you have of executing scripts via keyboard shortcut will work as well, as will your command-line itself, though. Alfred is definitely worth twenty dollars.

Finally, you will need <a href="http://growl.info/">Growl</a> if you don't already have it, and its CLI utility <a href="http://growl.info/extras.php#growlnotify">`growlnotify`</a>. If you're opposed to Growl for whatever reason, you don't need it, but it's a nice method of visual feedback.

I'm going to assume you already use a terminal multiplexor like `tmux` or `screen`, but if you don't you owe it to yourself to <a href="http://blog.hawkhost.com/2010/06/28/tmux-the-terminal-multiplexer/">look into it</a>.

<h2>The Execution</h2>

If you don't already have one, make a `.config/` directory in your home folder and add a `pianobar/` directory there as well. Here you'll make a file called `config` and write the following in it:

    user = username@email.com
    password = plaintext_password
    event_command = /Users/username/.config/pianobar/event-cmd

Setting your username and password here allows you to start up pianobar and immediately begin listening: it's no fun to have to type your username and p/w in every time (though if you're using tmux/screen you should rarely have to anyway). `event_command` lets you designate an executable that will accepts output from pianobar on every event (e.g. starting a new song, hating a song, explaining a song).

In that file, at `/Users/username/.config/pianobar/event-cmd` put <a href="/resources/pianobar-event-cmd">this</a> shell script. In short, it parses the output from pianobar sent with every event and, depending on what event is occurring, sends a certain message to Growl.

In the same directory put an icon you'd like to use, and call it `icon.png`. I used <a href="http://www.iconfinder.com/icondetails/42087/64/music_icon">this simple pixel eighth note</a> for my icon. It's also possible to specify different icons for different events, as you can see in the shell script.

Next you'll need to create a FIFO named "ctl" (with `mkfifo`) in the same directory. You can send commands to this file and pianobar will respond to them appropriately. Now is probably a good time to start up pianobar in a `tmux` session, too. Make sure everything is working so far.

Finally, we get to tie this all together:

<img height="512" width="662" alt="alfred setup screenshot" src="/images/alfred-pianobar.png" />

Here you can see my current (rapidly growing) list of shell commands Alfred handles for me. More pertinent are the "p" and "pp" commands. The former runs: `echo "{query}" > ~/.config/pianobar/ctl`, while the second just toggles play by passing the FIFO "p". In this way, I can open Alfred with `CMD+SPACE`, type "p" and a space, then pass any command to pianobar from there. Most often I send "n" for "next song" or "e" for "explain", which displays the title, artist and album of the song via Growl. If I wanted to, I could bind any function keys I'd like to these commands as well, but typing 3 characters works fine for me.

So I have a lightweight, easily controlled music setup. If you're cheap, the cost is free. If you'd like to support Pandora as well as get a fantastically useful application, that'll be <span>$</span>46.

If you'd like to expand more on this setup, be sure to read the pianobar man pages, which are very helpful; you can customize the keys used to control pianobar, manage even more events and more.
