var Song = require('./Song');

/**
 * A music library of Songs.
 *
 * This actually holds and manages a collection of Song models, each one unique.
 *
 * This is basically a fancy object/hash/dictionary, in format:
 *
 * {
 *     'abc123': Song,
 *     'xyz987': Song,
 * }
 *
 * With each key in the object the Song's unique ID (for fast lookups).
 */
class Library {
    /**
     * Construct a new Library.
     *
     * @param {array|object} array_or_object - An array of Songs, or an already-formatted bunch of Songs.
     */
    constructor(array_or_object) {
        this.library = {}; // start empty

        // the library may already be populated; deserialize if given something
        if (Array.isArray(array_or_object)) {
            this.deserialize(array_or_object);
        } else if (typeof array_or_object === 'object') {
            this.library = array_or_object;
        }
    }

    /**
     * Add a Song to this Library.
     *
     * @param {Song} song - The song to add.
     */
    addSong(song) {
        // adds song to library, with its key in this.library set to its unique ID
        if (!(song instanceof Song)) {
            return;
        }

        this.library[song.id] = song;
    }

    /**
     * Remove a Song from this Library by Song instance.
     *
     * @param {Song} song - The song to remove.
     */
    removeSong(song) {
        // remove song from the library based on its unqiue ID
        delete this.library[song.id];
    }

    /**
     * Remove a Song from this Library by Song ID.
     *
     * @param {string} song_id - The song ID to remove.
     */
    removeSongById(song_id) {
        // remove song from the library based on its unqiue ID
        delete this.library[song_id];
    }

    /**
     * Remove a Song from this Library by link.
     *
     * @param {string} link - The link of the song to remove.
     * @return {string} - The song ID removed
     */
    removeSongByLink(link) {
        var song_id_to_remove;
        for (var id in this.library) {
            if (this.library[id].link === link) {
                song_id_to_remove = id;
                break;
            }
        }
        if (song_id_to_remove !== undefined) {
            this.removeSongById(song_id_to_remove);
        }
        return song_id_to_remove;
    }

    /**
     * Get a Song in this Library by its ID.
     *
     * @param {string} song_id - The song ID to get.
     * @return {Song}
     */
    getSongById(song_id) {
        // get song info based on a unique ID
        return this.library[song_id];
    }

    /**
     * Return how many songs are in this library.
     *
     * @return {number}
     */
    length() {
        return Object.keys(this.library).length;
    }

    /**
     * Return a random Song from this Library.
     *
     * @return {Song}
     */
    getRandomSong() {
        var keys = Object.keys(this.library);
        var random_key_index = Math.floor(Math.random() * keys.length);
        var random_key = keys[random_key_index];
        return this.library[random_key];
    }

    /**
     * Return an array of song names contained in this library.
     *
     * @return {array}
     */
    getSongNames() {
        var song_names = [];
        for (var id in this.library) {
            song_names.push(this.library[id].getSongName());
        }
        return song_names;
    }

    /**
     * Deserialize the given array of serialized Song objects into a library.
     *
     * @param {array} array_of_songs - An array of serialized Song objects.
     */
    deserialize(array_of_songs) {
        if (!Array.isArray(array_of_songs)) {
            this.library = {}; // welp, empty
            return; // blah
        }
        // deserialize the given array of songs and make it this.library
        for (var i in array_of_songs) {
            if (typeof array_of_songs[i] !== 'object') {
                continue; // that wasn't a serialized song i guess
            }
            // deserialize the song
            var new_song = Song.deserialize(array_of_songs[i]);
            // make sure it's actually a song
            if (new_song instanceof Song) {
                // cool, add it to this library
                this.library[new_song.id] = new_song;
            }
        }
    }

    /**
     * Serialize this Library for storage as a JSON object.
     *
     * @return {object}
     */
    serialize() {
        // we'll store it as just a basic array
        var library_array = [];
        for (var index in this.library) {
            // serialize each song in here
            library_array.push(this.library[index].serialize());
        }
        return library_array;
    }
}

module.exports = Library;
