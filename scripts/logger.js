export class Logger {
    constructor(prefix, logLevel) {
        this.prefix = prefix;
    }

    log(message, ...args) {
        console.log(`${this.prefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`${this.prefix} ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`${this.prefix} ${message}`, ...args);
    }
}