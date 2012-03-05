module.exports = Statistics;
function Statistics() {
    this.history = [];
}

Statistics.unserialize = function(state) {
    var statistics = Object.create(Statistics.prototype);
    for (var key in state) statistics[key] = state[key];
    return statistics;
};

Statistics.prototype = {
    total: 0,
    pending: 0,
    unique: 0,
    duplicate: 0,
    failed: 0,
    skipped: 0,

    get remaining() {
        return this.total - this.unique - this.duplicate - this.failed - this.skipped;
    },

    set remaining() {}, // read-only

    get processed() {
        return this.unique + this.duplicate + this.failed + this.skipped;
    },

    set processed() {}, // read-only

    toJSON: function() {
        return {
            history: this.history,
            total: this.total,
            pending: 0,
            unique: this.unique,
            duplicate: this.duplicate,
            failed: this.failed,
            skipped: this.skipped
        };
    },

    snapshot: function() {
        var now = {
            date: Date.now(),
            total: this.total,
            pending: this.pending,
            unique: this.unique,
            duplicate: this.duplicate,
            failed: this.failed,
            skipped: this.skipped,
            remaining: this.remaining,
            processed: this.processed,
            speed: 0
        };

        // Keep a history of 10 seconds.
        this.history.push(now);
        while (this.history[0].date < now.date - 10000) this.history.shift();

        if (this.history.length >= 2) {
            var oldest = this.history[0];
            if (now.date > oldest.date) {
                now.speed = Math.round((now.processed - oldest.processed) / (now.date - oldest.date) * 1000);
            }
        }

        return now;
    }
};
