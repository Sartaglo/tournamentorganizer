"use strict";

const { saveRound } = require("./save-round");
const { sendUpdate } = require("./send-update");

const advanceTeams = (channel, state, roomNumber, teams) => {
    const currentRound = state.rounds.get(state.currentRoundNumber);
    const nextRound = state.rounds.get(state.currentRoundNumber + 1);
    const hostTeams = [];
    const nonHostTeams = [];
    const messages = [];
    teams.forEach(
        (team) => {
            const inAllHostTeams = state.allHostTeams.indexOf(team) !== -1;
            const inNextHostTeams = nextRound.hostTeams.indexOf(team) !== -1;
            const inAllNonHostTeams =
                state.allNonHostTeams.indexOf(team) !== -1;
            const inNextNonHostTeams =
                nextRound.nonHostTeams.indexOf(team) !== -1;
            const containingRooms = currentRound.rooms
                .map((room, index) => ({ roomNumber: index + 1, room }))
                .filter(({ room }) => room.includes(team));

            if (containingRooms.length > 0) {
                if (containingRooms[0].roomNumber !== roomNumber) {
                    messages.push(
                        "**Warning:** `"
                        + team
                        + "` was in room "
                        + containingRooms[0].roomNumber
                        + " of round "
                        + state.currentRoundNumber
                        + ".",
                    );
                }
            } else {
                messages.push(
                    "**Warning:** `"
                    + team
                    + "` was not in a room of round "
                    + state.currentRoundNumber
                    + ". This is to be expected with substitutes and manual"
                    + " registrations.",
                );
            }

            if (!inAllHostTeams && !inAllNonHostTeams) {
                messages.push(
                    "**Error:** `"
                    +
                    team
                    + "` is not registered in the tournament.",
                );
            } else if (inAllHostTeams) {
                if (inNextHostTeams) {
                    messages.push(
                        "**Error:** `"
                        + team
                        + "` has already been advanced to room "
                        + Array
                            .from(currentRound.advancementsByRoom)
                            .find(
                                ([_, advancements]) =>
                                    advancements.includes(team),
                            )[0]
                        + " of round "
                        + (state.currentRoundNumber + 1)
                        + ".",
                    );
                } else {
                    hostTeams.push(team);
                }
            } else {
                if (inNextNonHostTeams) {
                    messages.push(
                        "**Error:** `"
                        + team
                        + "` has already been advanced to room "
                        + Array
                            .from(currentRound.advancementsByRoom)
                            .find(
                                ([_, advancements]) =>
                                    advancements.includes(team),
                            )[0]
                        + " of round "
                        + (state.currentRoundNumber + 1)
                        + ".",
                    );
                } else {
                    nonHostTeams.push(team);
                }
            }
        },
    );
    nextRound.hostTeams.push(...hostTeams);
    nextRound.nonHostTeams.push(...nonHostTeams);
    currentRound.advancementsByRoom
        .get(roomNumber)
        .push(...hostTeams, ...nonHostTeams);
    saveRound(channel, state, state.currentRoundNumber + 1);

    return { hostTeams, nonHostTeams, messages };
};

exports.advance = async (channel, state, roomNumber, teams) => {
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
    } = advanceTeams(channel, state, roomNumber, teams);
    await sendUpdate(
        channel,
        state,
        "Advanced",
        roomNumber,
        hostTeams,
        nonHostTeams,
        messages,
        currentRound.advancementsByRoom,
        currentRound.advancementCount,
    );
};
