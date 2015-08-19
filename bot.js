/*

    radiobot. whoa.

*/

// mmmm lodash: https://lodash.com/docs
var _ = require('lodash');

// the offical slack client lib
var slack_client = require('slack-client');
var Message = require('./node_modules/slack-client/src/message');

// check for a config file when calling this script, we need it
if (process.argv.length < 3 || process.argv[2] == undefined) {
	console.log('testbot requires a config file passed to it, please see README.');
	process.exit(1);
}

// load bot config
console.log('requiring config in file: ' + process.argv[2]);
var config = require(process.argv[2]);

// primary bot config
var bot_name = config.bot_name;
var music_library = [
	{ artist: "disclosure", song: "omen", link: "https://www.youtube.com/watch?v=fB63ztKnGvo" }
];
var music_channels = {};

// init new instance of the slack real time client
// second param is autoReconnect, setting to false for now because it feels broken
var slack = new slack_client(config.api_token, false, false);

slack.on('open', function() {
	console.log(bot_name + ' is online, listening...');
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
		if (message.user == undefined) {
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

        if (message_realtype != 'channel') {
            say('sorry, but i do not respond to direct messages or in private groups; you could be cheating!', where);
            return;
        }

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
	// fetch channel/group/dm object
	var where = slack.getChannelGroupOrDMByID(message_obj.channel);
	// console.log(where);
	// where has .id and .name, if needed
	
	var radiobot_check = /radiobot/i;
	if (radiobot_check.test(chatline)) {
		if (/(gimme|give me) one of mine/i.test(chatline)) {
			// return a random song from the user's channel?
			return;
		}
		if (/(gimme|give me) one/i.test(chatline)) {
			// return a random song from the whole library?
			return;
		}
	}
	
	var radio_add_to_channel_check = /^\.radio add to ([-_a-z0-9]+) (.+)$/i;
	if (radio_add_to_channel_check.test(chatline)) {
		var radio_add_to_channel_matches = chatline.match(radio_add_to_channel_check);
		console.log('radio add to channel request: ', radio_add_to_channel_matches);
		
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
	
	var radio_add_general_check = /^\.radio add (.+)$/i;
	if (radio_add_general_check.test(chatline)) {
		var radio_add_general_matches = chatline.match(radio_add_general_check);
		console.log('radio general add request: ', radio_add_general_matches);
		
		var add_what = radio_add_general_matches[1].trim();
		console.log('adding "'+add_what+'" to '+username);
		
		var add_result = add_to_channel(add_what, username);
		if (add_result) {
			say('Added that to the "'+username+'" channel!', where);
		} else {
			say('Could not add that to the "'+username+'" channel for some reason...', where);
		}
		
		return;
	}
	
	var radio_set_check = /^\.radio set <(.+)> (.+) - (.+)$/i;
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
	
	var radio_help_check = /^\.radio( help)?/i;
	if (radio_help_check.test(chatline)) {
		say('Radio options: `.radio add (to [radio-station]) [link or artist - song name]` (adds to your user\'s radio station if a `to` is not given)'+"\n"+'`.radio set [link] [artist] - [song name]` to add something to the library for easier use later', where);
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
	
	var slack_link_regex = /^<(.+)>$/i;
	var artist_songname_regex = /^(.+) - (.+)$/i;
	
	// first test to see if it's a link they want to add
	if (slack_link_regex.test(what)) {
		var slack_link_matches = what.match(slack_link_regex);
		var links = slack_link_matches[1].trim().split("|");
		var the_link = links[0];
		console.log('the what is a link: ' + the_link);
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
			//console.log('welp could not find that');
			return false;
		}
	} else {
		console.log('the what is NOT a link or in "artist - song name" format!');
		return false;
	}
	
	console.log('updated channel "'+where+'":', music_channels[where]);
	
	return true;
}

// actually log in and connect!
slack.login();