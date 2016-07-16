/*

    radiobot/ravebot. whoa.

*/

// add a trim() method for strings
String.prototype.trim = function() { return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

// load external deps
var fs = require('fs');
var _ = require('lodash'); // mmmm lodash: https://lodash.com/docs
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http); // socket.io docs: http://socket.io/docs/

// the offical slack client lib
var SlackClient = require('slack-client');
var Message = require('./node_modules/slack-client/src/message');

// load our own dependencies
// our own custom logger, real simple
var Logger = require('./lib/Logger');
var Library = require('./lib/Library');
var Playlist = require('./lib/Playlist');
var Song = require('./lib/Song');
var Detector = require('./lib/Detector');

// check for a config file when calling this script, we need it
if (process.argv.length < 3 || process.argv[2] === undefined) {
	Logger.log('this requires a config file passed to it, please read the README.');
	process.exit(1);
}

// load that bot config
Logger.log('requiring config in file: ' + process.argv[2]);
var config = require(process.argv[2]);

// primary bot config from config file; imported to global scope cuz y not playa
var bot_name = config.bot_name;
var room_name = config.room_name;
var web_app_port = config.web_app_port;
var web_app_hostname = config.web_app_hostname;
var shared_control_password = config.shared_control_password;

// a few generated variables that we'll use
var backup_db_filename = bot_name + '-backup.json';
var selfcheck_regex = new RegExp('^@?'+bot_name+':?', 'i');
var selfcheck_regex2; // will be populated after we open the connection with slack
var jitter_min = 500; // the minimum amount of waiting before actually sending a message as the bot
var jitter_max = 1200; // the maximum amount of waiting before actually sending a message as the bot

// holds all the music
var musicLibrary = new Library({
    'fB63ztKnGvo': Song.newSongFromYouTube('https://www.youtube.com/watch?v=fB63ztKnGvo', 'disclosure', 'omen', 'cyle'),
    'm2z8Caoww44': Song.newSongFromYouTube('https://www.youtube.com/watch?v=m2z8Caoww44', 'disclosure', 'hourglass', 'cyle'),
    '1wc3RtxGftA': Song.newSongFromYouTube('https://www.youtube.com/watch?v=1wc3RtxGftA', 'disclosure', 'willing & able', 'cyle'),
    'gVN6FqPpChQ': Song.newSongFromYouTube('https://www.youtube.com/watch?v=gVN6FqPpChQ', 'disclosure', 'holding on', 'cyle'),
    'bkhLzHuUYmo': Song.newSongFromYouTube('https://www.youtube.com/watch?v=bkhLzHuUYmo', 'battles', 'the yabba', 'cyle'),
});

// holds all the channels
var currentPlaylist = new Playlist(room_name, [
    'fB63ztKnGvo',
    'm2z8Caoww44',
    '1wc3RtxGftA',
    'gVN6FqPpChQ',
    'bkhLzHuUYmo',
]);

// useful regexes
var slack_link_regex = /^<(.+)>$/i;
var artist_songname_regex = /^(.+) - (.+)$/i;

// save everything to backup file
function saveEverything() {
	var everything = {};
	everything.library = musicLibrary.serialize();
	everything.playlist = currentPlaylist.serialize();
	var everything_string = JSON.stringify(everything);
	fs.writeFile(backup_db_filename, everything_string, function(err) {
		if (err) {
			Logger.error((new Date()) + ': error saving backup db: ', err);
		} else {
			Logger.info((new Date()) + ': saved current db to file');
		}
	});
}

// load everything from backup file
function loadEverythingFromBackup() {
	fs.readFile(backup_db_filename, function(err, data) {
		if (err) {
			Logger.error('error reading backup db: ', err);
		} else {
			var everything = JSON.parse(data);
			musicLibrary = new Library(everything.library);
			currentPlaylist = new Playlist(everything.playlist.name, everything.playlist.songs);
			Logger.info('loaded backup db into current instance, yay!');
		}
	});
}

// try loading from a backup file if it exists
loadEverythingFromBackup();

// init new instance of the slack real time client
// second param is autoReconnect, setting to false for now because it feels broken
var slack = new SlackClient(config.api_token, false, false);

slack.on('open', function() {
	Logger.log(bot_name + ' is online, listening...');
	var self = slack.getUserByName(bot_name);
	selfcheck_regex2 = new RegExp('^<@'+self.id+'>:?');
});

slack.on('error', function(err) {
	Logger.error('there was an error with slack: ');
	Logger.error(err);
});

// intentionally crashing on websocket close
slack.on('close', function() {
	Logger.error('slack websocket closed for some reason, crashing!');
	process.exit(1);
});

// deal with incoming messages from slack
slack.on('message', function(message) {
	// relevant:
	// message.type = message,
	if (message.type === 'message') {
		// relevant: message.text, message.channel, message.user, message.ts

		// figure out what kind of message this is
		var message_realtype = 'unknown';
		if (message.channel[0] === 'C') {
			message_realtype = 'channel';
		} else if (message.channel[0] === 'G') {
			message_realtype = 'group';
		} else if (message.channel[0] === 'D') {
			message_realtype = 'dm';
		}

		// if there is no user, then it's probably not something we need to worry about
		if (message.user === undefined) {
			return;
		}

		// get user info
		var user_from = slack.getUserByID(message.user);
		// Logger.log(user_from);
		// user_from has .name and .id and more

		// fetch channel/group/dm object
		var where = slack.getChannelGroupOrDMByID(message.channel);
		// Logger.log(where);
		// where has .id and .name

        // ignore any messages not in the right room
        if (where.name !== room_name) {
            // say('NOPE.', where);
            return;
        }

		// send the incoming message off to be parsed + responded to
		parseMessage(message, user_from, message_realtype);
	} else {
		Logger.log(message);
		return; // do nothing with other types of messages for now
	}
});

/**
 * Return a random integer in the given range, inclusive.
 *
 * @param {number} min
 * @param {number} max
 * @return {number}
 */
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Actually say something in the given context; usually a Slack channel.
 *
 * @param {string} with_what - The message to send.
 * @param {*} where - The Slack Channel, DM, Group, to send the message in.
 */
function say(with_what, where) {
	if (with_what === undefined || where === undefined) {
		Logger.error('uhhh dunno what to say or where');
		return;
	}

	// first send typing indicator, classic trick
	var typing_indicator = new Message(slack, {
		'type': 'typing'
	});
	where.sendMessage(typing_indicator);

	// ok now send the actual message in a little while
	// this fuzziness makes the bot seem almost human
	setTimeout(function() {
		var the_message = new Message(slack, {
			'type': 'message',
			'text': with_what,
			'link_names': 1,
			'parse': 'full',
		});
		where.sendMessage(the_message);
	}, getRandomInt(jitter_min, jitter_max));
}

/**
 * Parse the incoming message from Slack.
 *
 * @param {Message} message_obj - The Slack Message object.
 * @param {User} user - The Slack User object.
 * @param {string} message_type - The message type.
 */
function parseMessage(message_obj, user, message_type) {
	var username = user.name;
	var chatline = message_obj.text.trim();

	// only check messages that start with bot's name
	if (selfcheck_regex.test(chatline) === false && selfcheck_regex2.test(chatline) === false) {
		return;
	}

	// strip out bot's name
	chatline = chatline.replace(selfcheck_regex, '').replace(selfcheck_regex2, '').trim();

	// fetch channel/group/dm object
	var where = slack.getChannelGroupOrDMByID(message_obj.channel);
	// Logger.log(where);
	// where has .id and .name, if needed

    // listen for someone asking for help
	if (/^help/i.test(chatline)) {
		say('Radio options:' + "\n" +
            '`add [link]` to just add a link to YouTube, Vimeo, or an mp3, mp4, or mov file' + "\n" +
            '`add [link] [artist] - [song name]` to do the same but with song info!' + "\n" +
			'`set [link|song ID] [artist] - [song name]` to set song info on something already added' + "\n" +
			'`play [link|song ID|artist - song name]` to play something right now' + "\n" +
			'`remove [link]`' + "\n" +
			'`next` and `previous` and `shuffle` do what you would expect' + "\n" +
			'`link` to get to where you can watch!',
			where);
		return;
	}

    // listen for someone trying to save a backup
    if (/^save/i.test(chatline)) {
		saveEverything();
		say('Saved everything nice and tight.', where);
		return;
	}

    // listen for someone just wanting a random song name from the library
	if (/(gimme|give me) one/i.test(chatline)) {
		// return a random song from the whole library?
		if (musicLibrary.length() === 0) {
			say('There isn\'t anything in the library for me to give you. Add stuff!', where);
		} else {
			var song = musicLibrary.getRandomSong();
			say('Random song link from your library: ' + song.link, where);
		}
		return;
	}

    // listen for someone wanting the link to watch
	if (/^(link|url)/i.test(chatline)) {
		say('View here: ' + web_app_hostname + ':' + web_app_port, where);
		return;
	}

    // listen for someone wanting a list of all songs in the library
    if (/^list( songs)?/i.test(chatline)) {
        if (musicLibrary.length() === 0) {
			say('There isn\'t anything in the library for me to give you. Add stuff!', where);
		} else {
			var song_names = musicLibrary.getSongNames();
			say('Songs currently in the library: ' + song_names.join(', '), where);
		}
		return;
    }

    // listen for someone wanting to go NEXT
	if (/^next/i.test(chatline)) {
        // get the next song in the current playlist
        // and send the update out to the clients
        say('NEXT SONG!', where);

        var next_song_id = currentPlaylist.nextSong();
        var playing_message = playSongNow(next_song_id);
        say(playing_message, where);

		return;
	}

    // listen for someone wanting to go BACK
    if (/^prev(ious)?/i.test(chatline)) {
        // get the previous song in the current playlist
        // and send the update out to the clients
        say('PREVIOUS SONG!', where);

        var next_song_id = currentPlaylist.previousSong();
        var playing_message = playSongNow(next_song_id);
        say(playing_message, where);

		return;
	}

    // listen for someone wanting to SHUFFLE
	if (/^shuffle/i.test(chatline)) {
        // get a random song in the current playlist
        // and send the update out to the clients
        say('SHUFFLING!', where);

        var next_song_id = currentPlaylist.getRandomSong();
        var playing_message = playSongNow(next_song_id);
        say(playing_message, where);

		return;
	}

    // listen to remove something from the library and playlist
	var remove_check = /^remove (.+)$/i;
	if (remove_check.test(chatline)) {
		var remove_matches = chatline.match(remove_check);
		// Logger.log('new remove request: ', remove_matches);
        var remove_what = remove_matches[1].trim();

        // try seeing if remove_what is an ID
        if (musicLibrary.getSongById(remove_what) instanceof Song) {
            currentPlaylist.removeSongById(remove_what);
            musicLibrary.removeSongById(remove_what);
        } else {
            // otherwise assume it's a link
            var slack_link_matches = remove_what.match(slack_link_regex);
            if (slack_link_matches) {
                var links = slack_link_matches[1].trim().split('|');
                var the_link = links[0];
                Logger.log('the what to remove is a link: ' + the_link);
                var removed_song_id = musicLibrary.removeSongByLink(the_link);
                currentPlaylist.removeSongById(removed_song_id);
            } else {
                // uhh dunno what it is then
                say('Hmm not sure what you are trying to remove... need a link or a Song ID.', where);
            }
        }

		say('Removed from library and playlists!', where);
		return;
	}

	// listen for someone wanting to play a thing right now
	var play_now_check = /^play (.+)$/i;
	if (play_now_check.test(chatline)) {
		var play_now_matches = chatline.match(play_now_check);
		Logger.log('play now check: ', play_now_matches);
		var play_what = play_now_matches[1].trim();

        // add support for saying "play disclosure" or matching against artist - title
        // and not just links/ids

        // check if the thing is an ID
        if (musicLibrary.getSongById(play_what) instanceof Song) {
            var playing_message = playSongNow(play_what);
            say(playing_message, where);
            return;
        } else {
            var slack_link_matches = play_what.match(slack_link_regex);
            if (slack_link_matches) {
                var links = slack_link_matches[1].trim().split('|');
                var the_link = links[0];
                Logger.log('the what to play now is a link: ' + the_link);
                // see if the thing is an acceptable link
                if (Detector.isAcceptableLink(the_link)) {
                    var identifier = Detector.getIdFromLink(the_link);
                    // see if we already have this thing
                    if (musicLibrary.getSongById(identifier) instanceof Song) {
                        // we do -- play it
                        Logger.log('we already have it. playing!');
                        var playing_message = playSongNow(identifier);
                        say(playing_message, where);
                        return;
                    } else {
                        Logger.log('we do NOT already have it. adding!');
                        // we ain't got it, add it as a new thing!
                        var new_song;
                        var link_media_type = Detector.getTypeFromLink(link);
                        switch (link_media_type) {
                            case 'youtube':
                            new_song = Song.newSongFromYouTube(link, '', '', username);
                            break;
                        }

                        if (!(new_song instanceof Song)) {
                            say('Could not make a song record out of that for some reason, sorry.', where);
                            return;
                        }

                        musicLibrary.addSong(new_song); // add to library
                        currentPlaylist.addSong(new_song); // add to current playlist
                        say('Cool, I\'ve added your song, it has ID `' + new_song.id + '`', where);
                        var playing_message = playSongNow(new_song.id);
                        say(playing_message, where);
                        return;
                    }
                }
            }
            say('Sorry, that link looks invalid to me.', where);
            return;
        }
        say('LOL, dunno what to do here, sorry.', where);
		return;
	}

    var id_and_info_regex = /(\S+)\s+(.+) - (.+)/i;

    // listen for someone wanting to add to the library
    var radio_add_general_check = /^add (.+)$/i;
    if (radio_add_general_check.test(chatline)) {
        var radio_add_general_matches = chatline.match(radio_add_general_check);
        Logger.log('radio add request: ', radio_add_general_matches);

        var add_what = radio_add_general_matches[1].trim();
        Logger.log('adding: ' + add_what);

        var link;
        var artist;
        var track_title;

        if (id_and_info_regex.test(add_what)) {
            // cool, let's see what we got
            var pieces = add_what.match(id_and_info_regex);
            link = pieces[1].trim();
            artist = pieces[2].trim();
            track_title = pieces[3].trim();
        } else {
            // must be just a link :(
            link = add_what;
        }

        Logger.log('link: ' + link + ', artist: ' + artist + ', title: ' + track_title);

        // make sure we got the right shit
        if (!Detector.isAcceptableLink(link)) {
            say('Sorry, that link looks invalid to me.', where);
            return;
        }

        var new_song;
        var link_media_type = Detector.getTypeFromLink(link);
        switch (link_media_type) {
            case 'youtube':
            new_song = Song.newSongFromYouTube(link, artist, track_title, username);
            break;
        }

        if (!(new_song instanceof Song)) {
            say('Could not make a song record out of that for some reason, sorry.', where);
            return;
        }

        musicLibrary.addSong(new_song); // add to library
        currentPlaylist.addSong(new_song); // add to current playlist
        say('Cool, I\'ve added your song, it has ID `' + new_song.id + '`', where);

        return;
    }

    // listen for someone wnting to set a certain song ID or link with artist and title info
    var radio_set_check = /^set (.+)$/i;
	if (radio_set_check.test(chatline)) {
		var radio_set_matches = chatline.match(radio_set_check);
		Logger.log('setting something: ', radio_set_matches);

        var set_what = radio_add_general_matches[1].trim();
        Logger.log('setting: ' + set_what);

        var pieces = set_what.match(id_and_info_regex);
        var identifier = pieces[1].trim();
        var artist = pieces[2].trim();
        var track_title = pieces[3].trim();
        Logger.log('id: ' + identifier + ', artist: ' + artist + ', title: ' + track_title);

        // ...

		return;
	}

    // if (/(gimme|give me) one of mine/i.test(chatline)) {
    // 	// return a random song from the user's channel?
    // 	if (music_channels[username] === undefined) {
    // 		say('@'+username+' you don\'t have anything for me to give you. Add stuff!', where);
    // 	} else {
    // 		var item = random_from_array(music_channels[username]);
    // 		say('Random thing from your playlist: ' + item, where);
    // 	}
    // 	return;
    // }

	// add to a specific playlist
	// var radio_add_to_channel_check = /^add to ([-_a-z0-9]+) (.+)$/i;
	// if (radio_add_to_channel_check.test(chatline)) {
	// 	var radio_add_to_channel_matches = chatline.match(radio_add_to_channel_check);
	// 	Logger.log('add to channel request: ', radio_add_to_channel_matches);
    //
	// 	var radio_channel = radio_add_to_channel_matches[1].trim();
	// 	var add_what = radio_add_to_channel_matches[2].trim();
	// 	Logger.log('adding "'+add_what+'" to '+radio_channel);
    //
	// 	var add_result = add_to_channel(add_what, radio_channel);
	// 	if (add_result) {
	// 		say('Added that to the "'+radio_channel+'" channel!', where);
	// 	} else {
	// 		say('Could not add that to the "'+radio_channel+'" channel for some reason...', where);
	// 	}
	// 	return;
	// }
} // end of slack message parsing

/**
 * Play the given song ID right now across all clients.
 *
 * @param {string} song_id - The song ID to play!
 * @return {string} - A message to send back to the clients
 */
function playSongNow(song_id) {
    var next_song = musicLibrary.getSongById(song_id);

    if (!(next_song instanceof Song)) {
        Logger.error('trying to play non-existent ID: ' + song_id);
        return;
    }

    // tell everyone to play it NOW!
    io.emit('play this', next_song.serialize());

    // include song info / contributor name here too
    return 'Now playing: ' + next_song.getSongName() + ' (added by ' + next_song.getContributor() + ')';
}

// set up the web client part of this
app.get('/', function(req, res){
	res.sendFile(__dirname + '/www/index.html');
});

// actually connect to Slack
slack.login();

// handle socket.io events from the web client
io.on('connection', function(socket) {
	Logger.log('a user connected to the web client');
	socket.on('disconnect', function() {
		Logger.log('user disconnected from the web client...');
	});

    // what do we do when the user connects? gotta start them somewhere
	//socket.emit('start', random_from_array(musicLibrary));
	//socket.emit('start', musicLibrary[0]);
    var starting_song_id = currentPlaylist.getCurrentSong();
    var starting_song = musicLibrary.getSongById(starting_song_id);
	socket.emit('start', starting_song.serialize());

    // the web client is done with a song and wants to know what's next
	socket.on('whats next', function(msg) {
		// Logger.log('whats next request: ', msg);
        if (msg.shared_control_password === shared_control_password) {
            var next_song_id;
            var next_song;
            if (msg.shuffle) {
                next_song_id = currentPlaylist.getRandomSong();
            } else {
                next_song_id = currentPlaylist.nextSong();
            }
            next_song = musicLibrary.getSongById(next_song_id);
            socket.emit('play this', next_song.serialize());
        } else {
            Logger.log('whats next request from an unauthorized source. ignoring.');
        }
	});
});

// set up the web server to serve the web client
http.listen(web_app_port, function(){
	Logger.log('Web server listening on *:' + web_app_port);
});

// save current library + playlist to a backup file every minute
//setInterval(saveEverything, 60000);
