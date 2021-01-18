"use strict";

exports.setRoundNumber = async (channel, state, roundNumber) => {
    if (!state.rounds.has(roundNumber)) {
        state.rounds.set(
            roundNumber,
            {
                hostTeams: [],
                nonHostTeams: [],
                advancementsByRoom: new Map(),
                advancementCount: null,
                rooms: [],
            },
        );
    }

    state.currentRoundNumber = roundNumber;
    await channel.send("Switched to round " + roundNumber + ".");
};
