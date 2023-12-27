---
layout: post
title: Tmux Simply Explained
summary: Wherein I write the introductory post to tmux that I wish I had when I first endeavoured to learn it.
categories: programming
date: 2013-06-06
---

<section>
If you work in the terminal regularly, and particularly if you work on a number of ongoing software projects, and *particularly* if you try to do everything code-related in the terminal, you should be using [`tmux`](http://tmux.sourceforge.net/) [[wiki]](http://en.wikipedia.org/wiki/Tmux) to mux your tees.

It's not immediately clear (and some would say, it's not even eventually clear) what `tmux` does, how it's useful, and what the terms regularly tossed around in it daily use (client, pane, window, server, etc.) mean.

It's a *terminal multiplexor*. From the website,

> What is a terminal multiplexer? It lets you switch easily between several programs in one terminal, detach them (they keep running in the background) and reattach them to a different terminal. And do a lot more.

As motivation for your using it, let me explain how I generally use it. I'll incorporate the terminology as I go. When I start a new project, I create a **session** with the name of my project. For example, `tmux new-session -s cryptopals` (most tmux commands can be shortened, but I'll use the unaliased names to make things clearer; in this case, I could've typed `tmux new -s cryptopals`). `tmux` will then launch a **client**, and I'll be presented with a new shell inside of a **window**.

Then I'll usually open a few more windows `ctrl-b : new-window <enter>` (try it—it'll make sense; you're basically opening a `tmux` command-line with `ctrl-b :`, and then typing in whatever command you'd like to execute, with whichever options you'd like to specify). I'll also split some windows into multiple `panes` with `ctrl-b %` or `ctrl-b : split-window -v` (to split it vertically, -h for horizontally). You can even adjust the size of panes, c.f. [this series of posts for more info on tmux](http://blog.hawkhost.com/2010/06/28/tmux-the-terminal-multiplexer/). At this point, you may be wondering if you can bind your own keys to `tmux` actions: of course you can. For instance, my `tmux` **escape sequence** is actually `ctr-z`, and I split windows vertically with `ctrl-z -` and horizontally with `ctrl-z \`. Much nicer, and more cooperative with my `emacs` keybindings. You can find my old `tmux` config [here](https://raw.github.com/ihodes/dotfiles/master/.tmux.conf).

After making windows, splitting them into panes, etc., I might get some work done on the project. When I'm done for the day, I'll `detach` the `client` from the `session` by hitting `ctrl-z : detach-client` (`ctrl-z d`). All the programs running in the session continue to run in the background. This can be extremely useful. Note, if you kill `tmux` or your computer loses power, you will lose your sessions and all unsaved work. You can also use [teamocil](http://teamocil.com/) to automate setting up **sessions** if you get tired of configuring your sessions after killing them.

When I'm ready to get back to work, I attach to my session  by firing up bash and typing `tmux attach -t cryptopals` (-t targets the session you wish to attach to; you can have multiple sessions running on the tmux server [think of it that way, anyway] on with independent windows and panes and programs). You can list all running sessions by typing `tmux list-sessions` (or, `tmux ls`).

That's my typical usage of `tmux`, and the basic understanding you need to have of it to use it gainfully. From here, you can probably start configuring it to your liking and reading more on it on your own. The `man` page is rather useful, and there is abundance of literature on the web on this subject as well.

--

It's also worth noting that multiple clients can connect to the same session, either on the same machine (not so useful) or over your network (very useful; you can pair-program, or whatever you'd like).

</section>
