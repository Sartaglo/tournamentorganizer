"use strict";

const fs = require("fs");

exports.saveRound = (channel, state, roundNumber) => {
    if (!state.rounds.has(roundNumber)) {
        return;
    }

    const { hostTeams, nonHostTeams } = state.rounds.get(roundNumber);
    fs.writeFileSync(
        channel.id + "-round-" + roundNumber + "-hosts.txt",
        hostTeams.join("\r\n"),
    );
    fs.writeFileSync(
        channel.id + "-round-" + roundNumber + "-non-hosts.txt",
        nonHostTeams.join("\r\n"),
    );
};
