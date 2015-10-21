/*

    radiobot/ravebot. whoa.

*/

// load external deps
var fs = require('fs');
var _ = require('lodash'); // mmmm lodash: https://lodash.com/docs
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http); // socket.io docs: http://socket.io/docs/

// the offical slack client lib
var slack_client = require('slack-client');
var Message = require('./node_modules/slack-client/src/message');

// check for a config file when calling this script, we need it
if (process.argv.length < 3 || process.argv[2] === undefined) {
	console.log('testbot requires a config file passed to it, please see README.');
	process.exit(1);
}

// load bot config
console.log('requiring config in file: ' + process.argv[2]);
var config = require(process.argv[2]);

// primary bot config
var bot_name = config.bot_name;
var app_url = config.app_url;
var backup_db_filename = bot_name + '-backup.json';
var selfcheck_regex = new RegExp('^@?'+bot_name+':?', 'i');
var selfcheck_regex2; // will be filled later

// music stuff
var current_song; // undefined for now

// holds all the music
var music_library = [
	{ artist: "disclosure", song: "omen", link: "https://www.youtube.com/watch?v=fB63ztKnGvo" },
	{ artist: "disclosure", song: "hourglass", link: "https://www.youtube.com/watch?v=m2z8Caoww44" },
	{ artist: "disclosure", song: "willing & able", link: "https://www.youtube.com/watch?v=1wc3RtxGftA" },
	{ artist: "disclosure", song: "holding on", link: "https://www.youtube.com/watch?v=gVN6FqPpChQ" },
	{ artist: "battles", song: "the yabba", link: "https://www.youtube.com/watch?v=bkhLzHuUYmo" }
];

// holds all the channels
var music_channels = {
	'hackdayraveroom': [
		"https://www.youtube.com/watch?v=bkhLzHuUYmo",
		"https://www.youtube.com/watch?v=fB63ztKnGvo",
		"https://www.youtube.com/watch?v=1wc3RtxGftA",
		"https://www.youtube.com/watch?v=gVN6FqPpChQ",
		"https://www.youtube.com/watch?v=m2z8Caoww44"
	]
};

// useful regexes
var slack_link_regex = /^<(.+)>$/i;
var artist_songname_regex = /^(.+) - (.+)$/i;

// save everything to backup file
function save_everything() {
	var everything = {};
	everything.library = music_library;
	everything.channels = music_channels;
	var everything_string = JSON.stringify(everything);
	fs.writeFile(backup_db_filename, everything_string, function(err) {
		console.info(new Date());
		if (err) {
			console.error('error saving backup db: ', err);
		} else {
			console.info('saved current db to file');
		}
	});
}

// load everything from backup file
function load_everything() {
	fs.readFile(backup_db_filename, function(err, data) {
		if (err) {
			console.error('error reading backup db: ', err);
		} else {
			var everything = JSON.parse(data);
			music_library = everything.library;
			music_channels = everything.channels;
			console.info('loaded backup db into current instance, yay!');
		}
	});
}

// try loading from a backup file if it exists
load_everything();

// init new instance of the slack real time client
// second param is autoReconnect, setting to false for now because it feels broken
var slack = new slack_client(config.api_token, false, false);

slack.on('open', function() {
	console.log(bot_name + ' is online, listening...');
	var self = slack.getUserByName(bot_name);
	selfcheck_regex2 = new RegExp('^<@'+self.id+'>:?');
});

slack.on('error', function(err) {
	console.error('there was an error with slack: ');
	console.error(err);
});

// intentionally crashing on websocket close
slack.on('close', function() {
	console.error('websocket closed for some reason, crashing!');
	process.exit(1);
});

slack.on('message', function(message) {

	// relevant:
	// message.type = message,

	if (message.type == 'message') {

		// relevant: message.text, message.channel, message.user, message.ts

		// store what kind of message this is
		var message_realtype = 'unknown';
		if (message.channel[0] == 'C') {
			message_realtype = 'channel';
		} else if (message.channel[0] == 'G') {
			message_realtype = 'group';
		} else if (message.channel[0] == 'D') {
			message_realtype = 'dm';
		}

		// if there is no user, then it's probably not something we need to worry about
		if (message.user === undefined) {
			return;
		}

		// get user info
		var user_from = slack.getUserByID(message.user);
		// console.log(user_from);
		//console.log(user_from);
		// user_from has .name and .id and more

		// fetch channel/group/dm object
		var where = slack.getChannelGroupOrDMByID(message.channel);
		// console.log(where);
		// where has .id and .name

		// send the incoming message off to be parsed + responded to
		parse_message(message, user_from, message_realtype);
	} else {
		console.log(message);
		return; // do nothing with other types of messages for now
	}
});

// add a trim() method for strings
String.prototype.trim = function() { return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

// get a random integer between range
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// random element from array
function random_from_array(things) {
	return things[Math.floor(Math.random() * things.length)];
}

// youtube helper function
function get_youtube_id(youtube_link) {
    var youtube_regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;
	var matches = youtube_link.match(youtube_regex);
	if (matches === undefined || matches === null || matches.length === 0 || matches[1] === undefined) {
		return undefined;
	}
    return matches[1];
}

// send a message to the specified channel/group/whatever
// "where" needs to be a channel/group/dm object
function say(with_what, where) {
	if (with_what === undefined || where === undefined) {
		console.error('uhhh dunno what to say or where');
		return;
	}
	// first send typing indicator
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
			'parse': 'full'
		});
		where.sendMessage(the_message);
	}, getRandomInt(500, 1200));
}

// parse incoming message object, username, and message type
function parse_message(message_obj, user, message_type) {
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
	// console.log(where);
	// where has .id and .name, if needed

	if (/(gimme|give me) one of mine/i.test(chatline)) {
		// return a random song from the user's channel?
		if (music_channels[username] === undefined) {
			say('@'+username+' you don\'t have anything for me to give you. Add stuff!', where);
		} else {
			var item = random_from_array(music_channels[username]);
			say('Random thing from your playlist: ' + item, where);
		}
		return;
	}

	if (/(gimme|give me) one/i.test(chatline)) {
		// return a random song from the whole library?
		if (music_library.length === 0) {
			say('There isn\'t anything in the library for me to give you. Add stuff!', where);
		} else {
			var item = random_from_array(music_library);
			say('Random thing from your library: ' + item.link, where);
		}
		return;
	}

	if (/^(link|url)/i.test(chatline)) {
		say('View here: ' + app_url, where);
		return;
	}

	if (/^next/i.test(chatline)) {
		var from_where;
		if (message_type === 'dm') {
			from_where = username;
		} else {
			from_where = where.name;
		}
		var song_to_send = get_next_song(current_song, from_where, false);
		say('NEXT!', where);
		play_now(song_to_send);
		return;
	}

	if (/^shuffle/i.test(chatline)) {
		var from_where;
		if (message_type === 'dm') {
			from_where = username;
		} else {
			from_where = where.name;
		}
		var song_to_send = get_next_song(current_song, from_where, true);
		say('SHUFFLING!', where);
		play_now(song_to_send);
		return;
	}

	var remove_check = /^remove (.+)$/i;
	if (remove_check.test(chatline)) {
		var remove_matches = chatline.match(remove_check);
		console.log('new remove request: ', remove_matches);
		var slack_link_matches = remove_matches[1].trim().match(slack_link_regex);
		var links = slack_link_matches[1].trim().split("|");
		var the_link = links[0];
		console.log('the what to remove is a link: ' + the_link);
		remove_song_by_link(the_link);
		say('Deleted!', where);
		return;
	}

	if (/^save/i.test(chatline)) {
		save_everything();
		say('Saved everything nice and tight.', where);
		return;
	}

	// play right now
	var play_now_check = /^play (.+)$/i;
	if (play_now_check.test(chatline)) {
		var play_now_matches = chatline.match(play_now_check);
		console.log('play now check: ', play_now_matches);
		var play_what = play_now_matches[1].trim();

		var slack_link_matches = play_what.match(slack_link_regex);
		var links = slack_link_matches[1].trim().split("|");
		var the_link = links[0];
		console.log('the what to play now is a link: ' + the_link);
		if (get_youtube_id(the_link) === undefined) {
			console.log('the link is not youtube! aborting!');
			return false;
		}

		var add_where;
		if (message_type === 'dm') {
			add_where = username;
		} else {
			add_where = where.name;
		}
		console.log('adding "'+the_link+'" to '+add_where);

		var add_result = add_to_channel(play_what, add_where); // this does its own re-parsing of the link
		if (add_result) {
			say('Added that to the "'+add_where+'" channel!', where);
			play_now(the_link); // should be a working link
		} else {
			say('Could not add that to the "'+add_where+'" channel for some reason... can\'t play it then...', where);
		}
		return;
	}

	// add to a specific playlist
	var radio_add_to_channel_check = /^add to ([-_a-z0-9]+) (.+)$/i;
	if (radio_add_to_channel_check.test(chatline)) {
		var radio_add_to_channel_matches = chatline.match(radio_add_to_channel_check);
		console.log('add to channel request: ', radio_add_to_channel_matches);

		var radio_channel = radio_add_to_channel_matches[1].trim();
		var add_what = radio_add_to_channel_matches[2].trim();
		console.log('adding "'+add_what+'" to '+radio_channel);

		var add_result = add_to_channel(add_what, radio_channel);
		if (add_result) {
			say('Added that to the "'+radio_channel+'" channel!', where);
		} else {
			say('Could not add that to the "'+radio_channel+'" channel for some reason...', where);
		}

		return;
	}

	// add to channel's playlist or user's, depending
	var radio_add_general_check = /^add (.+)$/i;
	if (radio_add_general_check.test(chatline)) {
		var radio_add_general_matches = chatline.match(radio_add_general_check);
		console.log('radio general add request: ', radio_add_general_matches);

		var add_what = radio_add_general_matches[1].trim();
		var add_where;
		if (message_type === 'dm') {
			add_where = username;
		} else {
			add_where = where.name;
		}
		console.log('adding "'+add_what+'" to '+add_where);

		var add_result = add_to_channel(add_what, add_where);
		if (add_result) {
			say('Added that to the "'+add_where+'" channel!', where);
		} else {
			say('Could not add that to the "'+add_where+'" channel for some reason...', where);
		}

		return;
	}

	var radio_set_check = /^set <(.+)> (.+) - (.+)$/i;
	if (radio_set_check.test(chatline)) {
		var radio_set_matches = chatline.match(radio_set_check);
		console.log('setting something: ', radio_set_matches);

		var set_result = add_to_library(radio_set_matches[2].trim(), radio_set_matches[3].trim(), radio_set_matches[1].trim());
		if (set_result) {
			say('Added that to the library, thanks!', where);
		} else {
			say('Could not add to the library for some reason. Check your syntax, maybe.', where);
		}

		return;
	}

	var radio_help_check = /^(help)?/i;
	if (radio_help_check.test(chatline)) {
		say('Radio options:' + "\n" +
		    '`add (to [radio-station]) [link or artist - song name]` (adds to your user\'s radio station if a `to` is not given)' + "\n" +
			'`set [link] [artist] - [song name]` to add something to the library for easier use later' + "\n" +
			'`play [link]` to play something right now' + "\n" +
			'`remove [link]` to remove a link from everywhere' + "\n" +
			'`next` and `shuffle` do what you would expect' + "\n" +
			'`link` to get to where you can watch! I control it, btw.',
			where);
		return;
	}

}

// add something to the library, yay
function add_to_library(the_artist, the_song_name, the_link) {
	if (the_artist === undefined || the_song_name === undefined || the_link === undefined) {
		return false;
	}
	var the_record = _.find(music_library, { artist: the_artist, song: the_song_name });
	if (the_record !== undefined) {
		// already exists... update the link!
		_.forEach(music_library, function(wat, index) {
			if (wat === the_record) {
				music_library[index].link = the_link;
			}
		});
	} else {
		music_library.push({ artist: the_artist, song: the_song_name, link: the_link });
	}
	console.log('updated library');
	return true;
}

// add something to a channel, yay
function add_to_channel(what, where) {
	if (what === undefined || where === undefined) {
		return false;
	}

	// make the channel if it doesn't exist
	if (music_channels[where] === undefined) {
		music_channels[where] = [];
	}

	// first test to see if it's just a link they want to add
	if (slack_link_regex.test(what)) {
		var slack_link_matches = what.match(slack_link_regex);
		var links = slack_link_matches[1].trim().split("|");
		var the_link = links[0];
		console.log('the what is a link: ' + the_link);
		if (get_youtube_id(the_link) === undefined) {
			console.log('the link is not youtube! aborting!');
			return false;
		}
		var the_record = _.find(music_library, { link: the_link });
		if (the_record === undefined) {
			music_library.push({ artist: undefined, song: undefined, link: the_link });
		}
		music_channels[where].push(the_link);
	} else if (artist_songname_regex.test(what)) {
		var artist_songname_matches = what.match(artist_songname_regex);
		var the_artist = artist_songname_matches[1].trim();
		var the_song_name = artist_songname_matches[2].trim();
		console.log('the what is "'+the_song_name+'" by "'+the_artist+'"');
		var the_link = _.result(_.find(music_library, { artist: the_artist, song: the_song_name }), 'link');
		if (the_link !== undefined) {
			music_channels[where].push(the_link);
			console.log('the link is: ' + the_link);
		} else {
			console.log('welp could not find that in the current library');
			return false;
		}
	} else {
		console.log('the what is NOT a link or in "artist - song name" format!');
		return false;
	}

	console.log('updated channel "'+where+'":', music_channels[where]);

	return true;
}

// helper function to send along a song object to everyone to play NOW
function play_now(the_song) {
	var song_to_send;
	if (the_song === undefined) {
		return false;
	} else if (the_song instanceof Object) {
		song_to_send = the_song;
	} else {
		// assume the input is a link
		song_to_send = get_song_object_from_link(the_song);
		if (song_to_send === undefined) {
			return false; // wasn't a valid link!
		}
	}
	current_song = song_to_send;
	console.log('sending along to everyone: ', song_to_send);
	io.emit('play this', song_to_send);
}

// helper to get a song object from the music library given a certain link
function get_song_object_from_link(the_link) {
	var link_index;
	_.forEach(music_library, function(wat, index) {
		if (wat.link === the_link) {
			link_index = index;
			return;
		}
	});
	return (link_index === undefined) ? undefined : music_library[link_index];
}

// helper to get the next song
// if no playlist is given, then assume music library instead
function get_next_song(song_just_finished, playlist, shuffle) {
	if (shuffle === undefined) {
		shuffle = false; // default
	}
	var song;
	if (playlist !== undefined && music_channels[playlist] !== undefined) {
		console.log('getting next song in playlist ' + playlist);
		// load from given playlist
		if (shuffle === true) {
			console.log('shuffling');
			var random_link_from_playlist = random_from_array(music_channels[playlist]);
			song = get_song_object_from_link(random_link_from_playlist);
		} else {
			console.log('playing next in playlist');
			var current_index_in_playlist = _.indexOf(music_channels[playlist], song_just_finished.link);
			console.log('current index in playlist: ', current_index_in_playlist);
			var next_link_in_playlist = music_channels[playlist][current_index_in_playlist + 1];
			if (next_link_in_playlist === undefined) {
				next_link_in_playlist = music_channels[playlist][0]; // go back to start
			}
			console.log('next link in playlist is: ' + next_link_in_playlist);
			_.forEach(music_library, function(wat, index) {
				if (wat.link === next_link_in_playlist) {
					song = wat;
					return;
				}
			});
		}
	} else {
		// load from library, not playlist
		if (shuffle === true) {
			song = random_from_array(music_library);
		} else {
			var next_index = 0;
			_.forEach(music_library, function(wat, index) {
				if (wat.link === just_finished.link) {
					next_index = index + 1;
					return;
				}
			});
			song = music_library[next_index];
		}
	}
	return song;
}

// helper to remove a song by link
function remove_song_by_link(the_link) {
	var i = music_library.length;
	while (i--) {
		if (music_library[i].link == the_link) {
			music_library.splice(i, 1);
		}
	}
	for (var playlist in music_channels) {
		var j = music_channels[playlist].length;
		while (j--) {
			if (music_channels[playlist][j] == the_link) {
				music_channels[playlist].splice(j, 1);
			}
		}
	}
}

// set up web application
app.get('/', function(req, res){
	res.sendFile(__dirname + '/www/index.html');
});

// actually log in and connect!
slack.login();

// socket.io handlers
io.on('connection', function(socket) {
	console.log('a user connected!');
	socket.on('disconnect', function(){
		console.log('user disconnected...');
	});
	//socket.emit('start', random_from_array(music_library));
	//socket.emit('start', music_library[0]);
	if (current_song === undefined) {
		current_song = music_library[3]; // start here if nothing else!
	}
	socket.emit('start', current_song);
	socket.on('whats next', function(msg) {
		console.log('whats next request: ', msg);
		var song_to_send = get_next_song(msg.just_finished, msg.playlist, msg.shuffle);
		play_now(song_to_send);
	});
});

// web server
http.listen(8080, function(){
	console.log('Web server listening on *:8080');
});

// save current library + channels to a backup file every minute
setInterval(save_everything, 60000);