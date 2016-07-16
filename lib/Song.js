
var Detector = require('./Detector')

// add a trim() method for strings
String.prototype.trim = function() { return this.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

/**
 * A Song!
 *
 * This is really an abstraction to keep a single model for multiple sources of songs.
 * YouTube, Vimeo, mp3s, mp4s, etc, can all be Songs.
 * And each Song should have a _globally unique_ ID. For example, its YouTube ID if it's a song from YouTube.
 *
 * Use the convenience static methods to make new Songs, such as
 * Song.newSongFromYouTube('https://www.youtube.com/watch?v=m2z8Caoww44', 'disclosure', 'hourglass', 'cyle')
 *
 * Because class constants don't exist, here are the valid string values for song type:
 * - youtube
 * - vimeo
 * - mp3
 * - mp4
 * - mov
 */
class Song {
    /**
     * Construct a new Song instance.
     * Usually you should NOT use this constructor directly;
     * use the helper static methods on this class instead.
     *
     * @param {string} id - The globally unique ID of the Song.
     * @param {string} type - The type of Song this is, i.e. is it from YouTube or is it an MP3
     * @param {string} link - The link to the song itself.
     * @param {string} [artist] - The artist of the song.
     * @param {string} [title] - The title of the song.
     * @param {string} [contributor] - Who added the song
     */
    constructor(id, type, link, artist = '', title = '', contributor = '') {
        this.id = id; // a unique ID, such as a YouTube ID
        this.type = type; // YouTube, Vimeo, mp3, mp4, mov
        this.artist = artist;
        this.title = title;
        this.link = link;
        this.contributor = contributor;
    }

    /**
     * Get a name for this Song.
     *
     * @return {string}
     */
    getSongName() {
        var artist;
        var title;

        // clean up the artist name
        if (typeof this.artist === 'string' && this.artist.trim() !== '') {
            artist = this.artist;
        }

        // clean up the title
        if (typeof this.title === 'string' && this.title.trim() !== '') {
            title = this.title;
        }

        // we have an artist, but no track title
        if (artist !== undefined && title === undefined) {
            return artist + ' - ???';
        }

        // we have no artist, but a track title
        if (artist === undefined && title !== undefined) {
            return '??? - ' + title;
        }

        // whoa we have both, yay!
        if (artist !== undefined && title !== undefined) {
            return artist + ' - ' + title;
        }

        // fall back to just sending along the link, haha
        return this.link;
    }

    /**
     * Get the name of who added this Song.
     *
     * @return {string}
     */
    getContributor() {
        return (this.contributor !== undefined && this.contributor.trim() !== '') ? this.contributor : 'unknown';
    }

    /**
     * Serialize this instance of a Song into an easily JSON-able object.
     * Used to back up this song info, or to send along to clients.
     *
     * @return {object}
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            artist: this.artist,
            title: this.title,
            link: this.link,
            contributor: this.contributor,
        };
    }

    /**
     * Deserialize the given object into a Song instance.
     *
     * @static
     * @param {object} object - The object to deserialize into a Song.
     * @return {Song}
     */
    static deserialize(object) {
        if (typeof object !== 'object') {
            return undefined; // derp...
        }
        // probably could use more validation than this
        // meaning some kind of validation at all...
        return new Song(
            object.id,
            object.type,
            object.link,
            object.artist,
            object.title,
            object.contributor
        );
    }

    /**
     * Create a new Song instance from a YouTube link and artist/title info.
     *
     * @static
     * @param {string} youtube_link - The YouTube link to use.
     * @param {string} [artist] - The artist name.
     * @param {string} [title] - The title name.
     * @param {string} [contributor] - The person adding the song.
     * @return {Song}
     */
    static newSongFromYouTube(youtube_link, artist = '', title = '', contributor = '') {
        // get youtube ID from given link
        var youtube_id = Detector.getYouTubeIdFromLink(youtube_link);
        if (youtube_id === undefined) {
            return undefined;
        }
        return new Song(
            youtube_id,
            'youtube',
            'https://www.youtube.com/watch?v=' + youtube_id, // normalize the link
            artist,
            title,
            contributor
        );
    }
}

module.exports = Song;
