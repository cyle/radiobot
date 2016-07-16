var Song = require('./Song');

/**
 * A class for handling a playlist of songs, where the songs are just
 * unique Song IDs, not actual Song objects.
 *
 * Basically this is just a fancy array.
 */
class Playlist {
    /**
     * Construct a new Playlist.
     *
     * @param {string} name - The name of the playlist
     * @param {array} [songs] - The song IDs to include in the playlist
     * @param {number} [currentIndex] - The index to start at
     */
    constructor(name, songs = [], currentIndex = 0) {
        this.name = name;
        this.songs = songs; // just a list of unique Song IDs
        this.currentIndex = currentIndex;
        this.cleanupIndex();
    }

    /**
     * Add a Song to this Playlist.
     *
     * @param {Song} song - The song to add, an actual instance of Song.
     */
    addSong(song) {
        if (!(song instanceof Song)) {
            return; // noooope
        }
        // add song's id to the end of this.songs[]
        this.songs.push(song.id)
    }

    /**
     * Add a song ID to this Playlist.
     *
     * @param {string} song_id - The song ID to add to this Playlist.
     */
    addSongById(song_id) {
        // add song id to the end of this.songs[]
        this.songs.push(song_id)
    }

    /**
     * Remove a song from this Playlist given a Song ID.
     *
     * @param {string} song_id - The song ID to remove.
     */
    removeSongById(song_id) {
        // search and remove song from this.songs[]
        // and then make sure this.songs[] is correctly indexed
        // and make sure the current index stays valid
        var index_to_remove;
        for (var index in this.songs) {
            if (this.songs[index] == song_id) {
                index_to_remove = index;
                break;
            }
        }
        if (index_to_remove !== undefined) {
            this.songs.splice(index_to_remove, 1);
            this.cleanupIndex();
        }
    }

    /**
     * Remove a song from this Playlist given an index.
     *
     * @param {number} song_index - The index in this.songs to remove.
     */
    removeSongByIndex(song_index) {
        // remove the song at the given index
        // and then make sure this.songs[] is correctly indexed
        // and make sure the current index stays valid
        this.songs.splice(song_index, 1);
        this.cleanupIndex();
    }

    /**
     * Increment the current playlist index and return the new song ID.
     *
     * @return {string}
     */
    nextSong() {
        // moves the current index forward,
        // returns the current song
        this.currentIndex++;
        this.cleanupIndex();
        return this.getCurrentSong();
    }

    /**
     * Decrement the current playlist index and return the new song ID.
     *
     * @return {string}
     */
    previousSong() {
        // moves the current index backward,
        // returns the current song
        this.currentIndex--;
        this.cleanupIndex();
        return this.getCurrentSong();
    }

    /**
     * Return a count of how many songs are in this Playlist.
     *
     * @return {number}
     */
    getSongCount() {
        return this.songs.length;
    }

    /**
     * Shuffle the current index and return the new song ID.
     *
     * @return {string}
     */
    getRandomSong() {
        // set the current index to random
        // returns the current song
        this.currentIndex = Math.floor(Math.random() * this.songs.length);
        return this.getCurrentSong();
    }

    /**
     * Return the current song ID.
     *
     * @return {string}
     */
    getCurrentSong() {
        // returns whatever song is at this.currentIndex
        return this.songs[this.currentIndex];
    }

    /**
     * Return this Playlist in an easily serializable form.
     *
     * @return {object}
     */
    serialize() {
        return {
            name: this.name,
            songs: this.songs,
            currentIndex: this.currentIndex,
        };
    }

    /**
     * Clean up any weirdness with the playlist index.
     * @private
     */
    cleanupIndex() {
        // check for nothin'
        if (this.songs.length === 0) {
            this.currentIndex = 0; // reset current index to 0
        }

        // see if we've gone over
        if (this.currentIndex >= this.songs.length) {
            this.currentIndex = 0; // reset current index to 0
        }

        // see if we've gone under
        if (this.currentIndex < 0) {
            this.currentIndex = this.songs.length - 1; // wrap around to the end
        }
    }
}

module.exports = Playlist;
