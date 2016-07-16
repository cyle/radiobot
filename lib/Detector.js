
// our magic youtube link detection regex
var youtube_regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

/**
 * A class to detect things... like whether a link is from YouTube or not.
 */
class Detector {
    /**
     * Get the media type from the given link.
     *
     * @param {string} link - The link to introspect.
     * @return {string|undefined} - The media type, or undefined if none was found
     */
    static getTypeFromLink(link) {
        if (Detector.isLinkYouTube(link)) {
            return 'youtube';
        }

        return undefined;
    }

    /**
     * Return whether or not this link is "acceptable".
     *
     * @param {string} link - The link to introspect.
     * @return {boolean}
     */
    static isAcceptableLink(link) {
        return (Detector.getTypeFromLink(link) === undefined) ? false : true;
    }

    /**
     * Get a globally unique ID from the given link.
     * You can use it to see if we already have this ID in a library.
     *
     * @param {string} link - The link to check.
     * @return {string|undefined} - The ID, or undefined if none could be derived.
     */
    static getIdFromLink(link) {
        var media_type = Detector.getTypeFromLink(link);
        switch (media_type) {
            case 'youtube':
            return Detector.getYouTubeIdFromLink(link);
            break;
            default:
            return undefined;
        }
    }

    /**
     * Get the unique YouTube ID from the given link.
     *
     * @param {string} youtube_link - The YouTube link to extract an ID from.
     * @return {string|undefined} The YouTube ID
     */
    static getYouTubeIdFromLink(youtube_link) {
    	var youtube_matches = youtube_link.match(youtube_regex);
    	if (youtube_matches === undefined || youtube_matches === null || youtube_matches.length === 0 || youtube_matches[1] === undefined) {
    		return undefined;
    	}
        return youtube_matches[1];
    }

    /**
     * Determine whether or not the given link is from YouTube.
     *
     * @param {string} link - The link to check.
     * @return {boolean}
     */
    static isLinkYouTube(link) {
        return (Detector.getYouTubeIdFromLink(link) === undefined) ? false : true;
    }
}

module.exports = Detector;
