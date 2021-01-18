"use strict";

const fs = require("fs");
const { shuffle } = require("./shuffle");

const getRoomParameters = async (channel, state) => {
    if (!state.rounds.has(state.currentRoundNumber)) {
        await channel.send(
            "Round " + state.currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const {
        hostTeams,
        nonHostTeams,
    } = state.rounds.get(state.currentRoundNumber);
    const playerCount =
        (hostTeams.length + nonHostTeams.length) * state.currentTeamSize;

    if (playerCount <= 12) {
        return { roomCount: 1, advancementCount: state.currentTeamSize };
    }

    if (playerCount <= 24) {
        return { roomCount: 2, advancementCount: 6 };
    }

    if (playerCount <= 36 && state.currentTeamSize < 3) {
        return { roomCount: 3, advancementCount: 8 };
    }

    if (playerCount <= 48) {
        return { roomCount: 4, advancementCount: 6 };
    }

    if (playerCount <= 72 && state.currentTeamSize < 3) {
        return { roomCount: 6, advancementCount: 8 };
    }

    if (playerCount <= 96) {
        return { roomCount: 8, advancementCount: 6 };
    }

    if (playerCount <= 108 && state.currentTeamSize < 3) {
        return { roomCount: 9, advancementCount: 8 };
    }

    if (playerCount <= 144 && state.currentTeamSize < 3) {
        return { roomCount: 12, advancementCount: 8 };
    }

    if (playerCount <= 192) {
        return { roomCount: 16, advancementCount: 6 };
    }

    if (playerCount <= 216 && state.currentTeamSize < 3) {
        return { roomCount: 18, advancementCount: 8 };
    }

    if (playerCount <= 288 && state.currentTeamSize < 3) {
        return { roomCount: 24, advancementCount: 8 };
    }

    if (playerCount <= 324 && state.currentTeamSize < 3) {
        return { roomCount: 27, advancementCount: 8 };
    }

    if (playerCount <= 384) {
        return { roomCount: 32, advancementCount: 6 };
    }

    if (playerCount <= 432 && state.currentTeamSize < 3) {
        return { roomCount: 36, advancementCount: 8 };
    }

    if (playerCount <= 648 && state.currentTeamSize < 3) {
        return { roomCount: 54, advancementCount: 8 };
    }

    if (playerCount <= 768) {
        return { roomCount: 64, advancementCount: 6 };
    }

    return null;
};

const generateRooms = async (channel, state, roomCount, advancementCount) => {
    const round = state.rounds.get(state.currentRoundNumber);
    round.advancementCount = advancementCount;
    const { hostTeams, nonHostTeams, advancementsByRoom } = round;

    if (hostTeams.length < roomCount) {
        const difference = roomCount - hostTeams.length;
        await channel.send(
            difference
            + " more host "
            + state.unitName
            + (difference === 1 ? " is" : "s are")
            +
            " needed.",
        );

        return;
    }

    const hosts = shuffle(hostTeams).slice(0, roomCount);
    round.rooms = hosts.map((host) => [host]);
    round.rooms.forEach(
        (_, index) => {
            advancementsByRoom.set(index + 1, []);
        },
    );
    hostTeams
        .filter((team) => hosts.indexOf(team) === -1)
        .concat(nonHostTeams)
        .forEach(
            (team, teamIndex) => {
                round.rooms[teamIndex % roomCount].push(team);
            },
        );
    const roomTexts = round.rooms.map(
        (room, roomIndex) => "ROOM "
            + (roomIndex + 1)
            + "\r\n"
            + room.join("\r\n"),
    );
    const fileName = channel.id
        + "-round-"
        + state.currentRoundNumber
        + "-rooms.txt";
    fs.writeFileSync(fileName, roomTexts.join("\r\n\r\n"));
    const advancingTeamCount = advancementCount / state.currentTeamSize;
    const pluralizer = advancingTeamCount === 1 ? "" : "s";
    await channel.send(
        "Room generation complete. "
        + (advancingTeamCount === 1
            ? ("The winning "
                + state.unitName
                + " of this room is the winner of the tournament.")
            : ("Advance the top "
                + advancingTeamCount
                + " "
                + state.unitName
                + pluralizer
                + " in each room.")),
        { files: [fileName] }
    );
};

exports.makeRooms = async (
    channel,
    state,
    manualRoomCount,
    manualAdvancementCount,
) => {
    if (!state.rounds.has(state.currentRoundNumber)) {
        await channel.send(
            "Round " + state.currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    if (Number.isInteger(manualRoomCount)
        && Number.isInteger(manualAdvancementCount)) {
        generateRooms(channel, state, manualRoomCount, manualAdvancementCount);
    } else {
        const {
            roomCount,
            advancementCount,
        } = await getRoomParameters(channel, state);

        if (roomCount === null) {
            await channel.send("At most 768 players are supported.");

            return;
        }

        generateRooms(channel, state, roomCount, advancementCount);
    }
};
