"use strict";

const { saveRound } = require("./save-round");
const { sendUpdate } = require("./send-update");

const unadvanceTeams = (channel, state, roomNumber, teams) => {
    const nextRound = state.rounds.get(state.currentRoundNumber + 1);
    const advancements = state
        .rounds
        .get(state.currentRoundNumber)
        .advancementsByRoom
        .get(roomNumber);
    const hostTeams = [];
    const nonHostTeams = [];
    const messages = [];
    teams.forEach(
        (team) => {
            if (!advancements.includes(team)) {
                messages.push(
                    "**Error**: `"
                    + team
                    + "` has not been advanced to room "
                    + roomNumber
                    + " of round "
                    + (state.currentRoundNumber + 1)
                    + "."
                );
            } else if (nextRound.hostTeams.indexOf(team) !== -1) {
                hostTeams.push(team);
            } else if (nextRound.nonHostTeams.indexOf(team) !== -1) {
                nonHostTeams.push(team);
            } else {
                messages.push(
                    "**Error:** `"
                    + team
                    + "` has not been advanced to round "
                    + (state.currentRoundNumber + 1)
                    + ".",
                );
            }
        },
    );
    hostTeams.forEach(
        (team) => {
            nextRound.hostTeams.splice(
                nextRound.hostTeams.indexOf(team),
                1,
            );
            advancements.splice(
                advancements.indexOf(team),
                1,
            );
        }
    );
    nonHostTeams.forEach(
        (team) => {
            nextRound.nonHostTeams.splice(
                nextRound.nonHostTeams.indexOf(team),
                1,
            );
            advancements.splice(
                advancements.indexOf(team),
                1,
            );
        }
    );
    saveRound(channel, state, state.currentRoundNumber + 1);

    return { hostTeams, nonHostTeams, messages };
};

exports.unadvance = async (channel, state, roomNumber, teams) => {
    const currentRound = state.rounds.get(state.currentRoundNumber);

    if (!currentRound.advancementsByRoom.has(roomNumber)) {
        await channel.send(
            "Room "
            + roomNumber
            + " of round "
            + state.currentRoundNumber
            + " has not been initialized.",
        );

        return;
    }

    const {
        hostTeams,
        nonHostTeams,
        messages,
    } = unadvanceTeams(channel, state, roomNumber, teams);
    await sendUpdate(
        channel,
        state,
        "Unadvanced",
        roomNumber,
        hostTeams,
        nonHostTeams,
        messages,
        currentRound.advancementsByRoom,
        currentRound.advancementCount,
    );
};
