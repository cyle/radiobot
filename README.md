# Radiobot for Slack

## What?

It's a bot to help you set up your own radio station with channels (playlists) and crap. Yay!

## Installation

### Bot API Key

You need an API key for your bot.

Go to your Slack instance, go to Integrations, then Bot integrations, and make a new one.

Grab that API key. Save it for the config file in a second.

### Manually...

Clone this repo, make sure you have `node` and `npm` installed!

Edit the `package.json` with your name.

Run `npm install` to install dependencies.

Rename `config.sample.js` to `config.js` and edit it with your own config.

Run `node /path/to/bot.js /path/to/config.js` to get it running. Even if your config file is in the same directory as the bot, you still have to specify the relative path, i.e. `./config.js`.

Invite radiobot to your channel!

### ... or with Docker

You can also use this with Docker! Update the `Dockerfile` with your email address.

    docker build -t your-name/radiobot .
    docker run -d your-name/radiobot

Nice.

## Usage

... to be written fully, still in dev ...

## Roadmap / todos

- [ ] persistent database storage (mysql? mongodb? whatever?)
- [ ] web GUI, lol
- [ ] web GUI: view music library, add/edit/delete/search tracks
- [ ] web GUI: view channels, add/reorder/delete tracks
- [ ] web GUI: playback of a channel, or the whole library, whatever
- [ ] web GUI: channel options: shuffle mode, ordered mode, live mode
- [ ] namespace `radiobot` for commands as well, i.e. `radiobot add [link]`
