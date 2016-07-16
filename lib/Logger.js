var Logger = {
    info: function(message, thing) {
        console.info((new Date()) + ': [INFO] ' + message);
        if (thing) {
            console.info(thing);
        }
    },
    error: function(message, thing) {
        console.error((new Date()) + ': [ERROR] ' + message);
        if (thing) {
            console.error(thing);
        }
    },
    log: function(message, thing) {
        console.log((new Date()) + ': [LOG] ' + message);
        if (thing) {
            console.log(thing);
        }
    },
}

module.exports = Logger;
