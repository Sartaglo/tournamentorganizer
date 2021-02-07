"use strict";

const { sendOutput } = require("./send-output");

exports.sendUpdate = async (
    channel,
    state,
    action,
    roomNumber,
    hostTeams,
    nonHostTeams,
    messages,
    advancementsByRoom,
    advancementCount,
) => {
    const nextRound = state.rounds.get(state.currentRoundNumber + 1);
    const teamCount = nextRound.hostTeams.length
        + nextRound.nonHostTeams.length;
    const baseContent = action
        + " "
        + hostTeams.length
        + " host "
        + state.unitName
        + (hostTeams.length === 1 ? "" : "s")
        + " and "
        + nonHostTeams.length
        + " non-host "
        + state.unitName
        + (nonHostTeams.length === 1 ? "" : "s")
        + ". Room "
        + roomNumber
        + " of round "
        + state.currentRoundNumber
        + " now has "
        + advancementsByRoom.get(roomNumber).length
        + "/"
        + (advancementCount / state.currentTeamSize)
        + " advanced "
        + state.unitName
        + (advancementCount === 1 ? "" : "s")
        + ". Round "
        + (state.currentRoundNumber + 1)
        + " now has "
        + nextRound.hostTeams.length
        + " host "
        + state.unitName
        + (nextRound.hostTeams.length === 1 ? "" : "s")
        + " and "
        + nextRound.nonHostTeams.length
        + " non-host "
        + state.unitName
        + (nextRound.nonHostTeams.length === 1 ? "" : "s")
        + " for a total of "
        + teamCount
        + " "
        + state.unitName
        + (teamCount === 1 ? "" : "s")
        + ".";
    const fileName = channel.id
        + "-"
        + action.toLowerCase().slice(0, action.length - 1)
        + "-output.txt";
    await sendOutput(channel, baseContent, messages, fileName, []);
};
