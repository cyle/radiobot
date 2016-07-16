# Radiobot for Slack

## WARNING

*This is very much not ready. It's in development.*

## What?

It's a bot to help you set up your own radio station with channels (playlists) and crap. Yay!

## Installation

### Bot Slack API Key

You need a Slack API key for your bot.

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

Note: this bot makes library/playlist backups to JSON files for persistence, and that won't really work if you are using docker.

## Usage

... to be written fully, still in dev ...

Examples:

- Add a video to the default playlist: `@radiobot add https://www.youtube.com/watch?v=fB63ztKnGvo`
- Set the info for a link: `@radiobot set https://www.youtube.com/watch?v=fB63ztKnGvo disclosure - omen`

For playback, go to http://box-running-the-bot.com:8080/ and enjoy.

## Roadmap / todos

- [ ] support for more than just YouTube:
- [ ] add support for Vimeo
- [ ] add support for mp3 links
- [ ] add support for mp4/mov links
- [ ] persistent database storage (mysql? mongodb? whatever?)
- [ ] web GUI: view music library, add/edit/delete/search tracks
- [ ] web GUI: view channels, add/reorder/delete tracks
- [ ] web GUI: playback of a channel, or the whole library, whatever
- [ ] web GUI: channel options: shuffle mode, ordered mode, live mode
- [x] web GUI, lol
- [x] namespace `radiobot` for commands as well, i.e. `radiobot add [link]`
