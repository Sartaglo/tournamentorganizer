"use strict";

const fs = require("fs");
const { shuffle } = require("./shuffle");
const { useDocs } = require("./use-docs");

const botMention = "<@784938036478738463>";

let allHostTeams = [];

let allNonHostTeams = [];

let currentTeamSize = 1;

let unitName = "team";

let currentRoundNumber = 1;

let rounds = new Map();

const saveRound = (roundNumber) => {
    if (!rounds.has(roundNumber)) {
        return;
    }

    const { hostTeams, nonHostTeams } = rounds.get(roundNumber);
    fs.writeFileSync(
        "round-" + roundNumber + "-hosts.txt",
        hostTeams.join("\r\n"),
    );
    fs.writeFileSync(
        "round-" + roundNumber + "-non-hosts.txt",
        nonHostTeams.join("\r\n"),
    );
}

const tryUseDocs = async () => {
    try {
        return await useDocs();
    } catch (error) {
        console.error("Error using Docs:", error);

        return null;
    }
}

const parseRegistration = (content, startIndex) => {
    let registration = null;
    let contentIndex = null;

    for (
        contentIndex = startIndex;
        contentIndex < content.length;
        contentIndex += 1
    ) {
        if (!content[contentIndex].paragraph) {
            if (registration !== null) {
                break;
            }

            continue;
        }

        if (content[contentIndex].paragraph.bullet) {
            if (registration !== null) {
                break;
            }

            registration = content[contentIndex].paragraph.elements
                .map((element) => element.textRun.content)
                .join("");
        } else if (registration !== null) {
            const text = content[contentIndex].paragraph.elements
                .map((element) => element.textRun.content)
                .join("");

            if (text.match(/^\s*$/)) {
                break;
            }

            registration += text;
        }
    }

    return {
        registration: registration.trim().replace(/\s+/g, " "),
        nextIndex: contentIndex,
    };
};

const findNextRegistration = (content, startIndex) => {
    for (
        let contentIndex = startIndex;
        contentIndex < content.length;
        contentIndex += 1
    ) {
        if (content[contentIndex].paragraph
            && content[contentIndex].paragraph.bullet) {
            return contentIndex;
        }
    }
};

const initialize = async (
    channel,
    documentId,
    teamSize,
    hostCount,
    nonHostCount,
) => {
    const docs = await tryUseDocs();

    if (docs === null) {
        return;
    }

    docs.documents.get(
        { documentId },
        async (error, response) => {
            if (error) {
                console.error("The API returned an error:", error);

                return;
            }

            allHostTeams = [];
            allNonHostTeams = [];
            currentTeamSize = teamSize;
            unitName = teamSize === 1 ? "player" : "team";
            currentRoundNumber = 1;
            const content = response.data.body.content;
            let contentIndex = 0;

            while (allHostTeams.length < hostCount
                && contentIndex < content.length) {
                const { registration, nextIndex } = parseRegistration(
                    content,
                    contentIndex,
                );
                allHostTeams.push(registration);
                contentIndex = nextIndex;
            }

            contentIndex = findNextRegistration(content, contentIndex);

            while (allNonHostTeams.length < nonHostCount
                && contentIndex < content.length) {
                const { registration, nextIndex } = parseRegistration(
                    content,
                    contentIndex,
                );

                if (!registration.match(/^\s*$/)) {
                    allNonHostTeams.push(registration);
                }

                contentIndex = nextIndex;
            }

            rounds = new Map();
            rounds.set(
                1,
                {
                    hostTeams: allHostTeams.slice(),
                    nonHostTeams: allNonHostTeams.slice(),
                    advancementsByRoom: new Map(),
                    advancementCount: null,
                });
            saveRound(1);
            await channel.send(
                "Initialization complete.",
                { files: ["round-1-hosts.txt", "round-1-non-hosts.txt"] },
            );
        }
    );
};

const setRoundNumber = async (channel, roundNumber) => {
    if (!rounds.has(roundNumber)) {
        rounds.set(
            roundNumber,
            {
                hostTeams: [],
                nonHostTeams: [],
                advancementsByRoom: new Map(),
                advancementCount: null,
            },
        );
    }

    currentRoundNumber = roundNumber;
    await channel.send("Switched to round " + roundNumber + ".");
}

const sendUpdate = async (
    channel,
    action,
    currentRound,
    roomNumber,
    hostTeams,
    nonHostTeams,
    advancementsByRoom,
    advancementCount,
) => {
    const teamCount = currentRound.hostTeams.length
        + currentRound.nonHostTeams.length;
    await channel.send(
        action
        + " "
        + hostTeams.length
        + " host "
        + unitName
        + (hostTeams.length === 1 ? "" : "s")
        + " and "
        + nonHostTeams.length
        + " non-host "
        + unitName
        + ". Room "
        + roomNumber
        + " of round "
        + currentRoundNumber
        + " now has "
        + advancementsByRoom.get(roomNumber).length
        + "/"
        + (advancementCount / currentTeamSize)
        + " advanced "
        + unitName
        + ". There are now "
        + currentRound.hostTeams.length
        + " host "
        + unitName
        + (currentRound.hostTeams.length === 1 ? "" : "s")
        + " and "
        + currentRound.nonHostTeams.length
        + " non-host "
        + unitName
        + (currentRound.nonHostTeams.length === 1 ? "" : "s")
        + " for a total of "
        + teamCount
        + " "
        + unitName
        + (teamCount === 1 ? "" : "s")
        + ".");
}

const advanceTeams = (nextRound, advancements, teams) => {
    let hostTeams = [];
    let nonHostTeams = [];
    teams.forEach(
        (team) => {
            if (allHostTeams.indexOf(team) !== -1
                && nextRound.hostTeams.indexOf(team) === -1) {
                hostTeams.push(team);
            } else if (allNonHostTeams.indexOf(team) !== -1
                && nextRound.nonHostTeams.indexOf(team) === -1) {
                nonHostTeams.push(team);
            }
        },
    );
    nextRound.hostTeams.push(...hostTeams);
    nextRound.nonHostTeams.push(...nonHostTeams);
    advancements.push(...hostTeams, ...nonHostTeams);
    saveRound(currentRoundNumber + 1);

    return { hostTeams, nonHostTeams };
};

const advance = async (channel, roomNumber, teams) => {
    const {
        advancementsByRoom,
        advancementCount,
    } = rounds.get(currentRoundNumber);

    if (!advancementsByRoom.has(roomNumber)) {
        return;
    }

    const nextRound = rounds.get(currentRoundNumber + 1);
    const {
        hostTeams,
        nonHostTeams,
    } = advanceTeams(nextRound, advancementsByRoom.get(roomNumber), teams);
    await sendUpdate(
        channel,
        "Advanced",
        nextRound,
        roomNumber,
        hostTeams,
        nonHostTeams,
        advancementsByRoom,
        advancementCount,
    );
};

const unadvanceTeams = (nextRound, advancements, teams) => {
    let hostTeams = [];
    let nonHostTeams = [];
    teams.forEach(
        (team) => {
            if (allHostTeams.indexOf(team) !== -1
                && nextRound.hostTeams.indexOf(team) !== -1) {
                hostTeams.push(team);
            } else if (allNonHostTeams.indexOf(team) !== -1
                && nextRound.nonHostTeams.indexOf(team) !== -1) {
                nonHostTeams.push(team);
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
    saveRound(currentRoundNumber + 1);

    return { hostTeams, nonHostTeams };
};

const unadvance = async (channel, roomNumber, teams) => {
    const {
        advancementsByRoom,
        advancementCount,
    } = rounds.get(currentRoundNumber);

    if (!advancementsByRoom.has(roomNumber)) {
        await channel.send(
            "Room "
            + roomNumber
            + " of round "
            + currentRoundNumber
            + " has not been initialized.",
        );

        return;
    }

    const nextRound = rounds.get(currentRoundNumber + 1);
    const {
        hostTeams,
        nonHostTeams,
    } = unadvanceTeams(nextRound, advancementsByRoom.get(roomNumber), teams);
    await sendUpdate(
        channel,
        "Unadvanced",
        nextRound,
        roomNumber,
        hostTeams,
        nonHostTeams,
        advancementsByRoom,
        advancementCount,
    );
}

const getRoomParameters = async () => {
    if (!rounds.has(currentRoundNumber)) {
        await channel.send(
            "Round " + currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const { hostTeams, nonHostTeams } = rounds.get(currentRoundNumber);
    const playerCount =
        (hostTeams.length + nonHostTeams.length) * currentTeamSize;

    if (playerCount <= 12) {
        return { roomCount: 1, advancementCount: 6 };
    }

    if (playerCount <= 24) {
        return { roomCount: 2, advancementCount: 6 };
    }

    if (playerCount <= 36 && currentTeamSize < 3) {
        return { roomCount: 3, advancementCount: 8 };
    }

    if (playerCount <= 48) {
        return { roomCount: 4, advancementCount: 6 };
    }

    if (playerCount <= 72 && currentTeamSize < 3) {
        return { roomCount: 6, advancementCount: 8 };
    }

    if (playerCount <= 96) {
        return { roomCount: 8, advancementCount: 6 };
    }

    if (playerCount <= 108 && currentTeamSize < 3) {
        return { roomCount: 9, advancementCount: 8 };
    }

    if (playerCount <= 144 && currentTeamSize < 3) {
        return { roomCount: 12, advancementCount: 8 };
    }

    if (playerCount <= 192) {
        return { roomCount: 16, advancementCount: 6 };
    }

    if (playerCount <= 216 && currentTeamSize < 3) {
        return { roomCount: 18, advancementCount: 8 };
    }

    if (playerCount <= 288 && currentTeamSize < 3) {
        return { roomCount: 24, advancementCount: 8 };
    }

    if (playerCount <= 324 && currentTeamSize < 3) {
        return { roomCount: 27, advancementCount: 8 };
    }

    if (playerCount <= 384) {
        return { roomCount: 32, advancementCount: 6 };
    }

    if (playerCount <= 432 && currentTeamSize < 3) {
        return { roomCount: 36, advancementCount: 8 };
    }

    if (playerCount <= 648 && currentTeamSize < 3) {
        return { roomCount: 54, advancementCount: 8 };
    }

    if (playerCount <= 768) {
        return { roomCount: 64, advancementCount: 6 };
    }

    return null;
}

const makeRooms = async (channel) => {
    if (!rounds.has(currentRoundNumber)) {
        await channel.send(
            "Round " + currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const { roomCount, advancementCount } = await getRoomParameters();

    if (roomCount === null) {
        await channel.send("At most 768 players are supported.");

        return;
    }

    const round = rounds.get(currentRoundNumber);
    round.advancementCount = advancementCount;
    const { hostTeams, nonHostTeams, advancementsByRoom } = round;

    if (hostTeams.length < roomCount) {
        const difference = roomCount - hostTeams.length;
        await channel.send(
            difference
            + " more host "
            + unitName
            + (difference === 1 ? " is" : "s are")
            +
            " needed.",
        );

        return;
    }

    const hosts = shuffle(hostTeams).slice(0, roomCount);
    const rooms = hosts.map((host) => [host]);
    rooms.forEach((_, index) => advancementsByRoom.set(index + 1, []));
    hostTeams
        .filter((team) => hosts.indexOf(team) === -1)
        .concat(nonHostTeams)
        .forEach(
            (team, teamIndex) => {
                rooms[teamIndex % roomCount].push(team);
            },
        );
    const roomTexts = rooms.map(
        (room, roomIndex) => "ROOM "
            + (roomIndex + 1)
            + "\r\n"
            + room.join("\r\n"),
    );
    const fileName = "round-" + currentRoundNumber + "-rooms.txt";
    fs.writeFileSync(fileName, roomTexts.join("\r\n\r\n"));
    const advancingTeamCount = advancementCount / currentTeamSize;
    await channel.send(
        "Room generation complete. Advance the top "
        + advancingTeamCount
        + " "
        + unitName
        + (advancingTeamCount === 1 ? "" : "s")
        + " in each room.",
        { files: [fileName] }
    );
};

const getRoomResults = async (channel, roomNumber) => {
    if (!rounds.has(currentRoundNumber)) {
        await channel.send(
            "Round " + currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const { advancementsByRoom } = rounds.get(currentRoundNumber);

    await channel.send(
        "Room "
        + roomNumber
        + " of round "
        + currentRoundNumber
        + " has "
        + (advancementsByRoom.has(roomNumber)
            && advancementsByRoom.get(roomNumber).length > 0
            ? ("the following advancement"
                + (advancementsByRoom.get(roomNumber).length === 1 ? "" : "s")
                + ":\n"
                + advancementsByRoom.get(roomNumber).join("\n"))
            : "zero advancements."),
    );
};

module.exports = {
    actOnMessage: async (message) => {
        if (message.author.id !== "484822486861611011") {
            return;
        }

        const segments = message.content.replace(/ +/g, " ").split(" ");

        if (segments.length < 2 || segments[0] !== botMention) {
            return;
        }

        const [_, command, ...parameters] = segments;

        if (command === "initialize") {
            const documentId = parameters[0];
            const teamSize = Number.parseInt(parameters[1], 10);
            const hostCount = Number.parseInt(parameters[2], 10);
            const nonHostCount = Number.parseInt(parameters[3], 10);

            if (typeof documentId !== "string"
                || documentId.length === 0
                || ![1, 2, 3].includes(teamSize)
                || !Number.isSafeInteger(hostCount)
                || !Number.isSafeInteger(nonHostCount)) {
                await message.channel.send(
                    "Usage: initialize"
                    + " <documentId> <teamSize> <hostCount> <nonHostCount>",
                );

                return;
            }

            await initialize(
                message.channel,
                documentId,
                teamSize,
                hostCount,
                nonHostCount,
            );
        } else if (command === "round") {
            const roundNumber = Number.parseInt(parameters[0], 10);

            if (!Number.isSafeInteger(roundNumber)) {
                await message.channel.send("Usage: round <roundNumber>");

                return;
            }

            await setRoundNumber(message.channel, roundNumber);
        } else if (command === "rooms") {
            await makeRooms(message.channel);
        } else if (command === "results") {
            const roomNumber = Number.parseInt(parameters[0], 10);

            if (!Number.isSafeInteger(roomNumber)) {
                await message.channel.send("Usage: results <roomNumber>");

                return;
            }

            await getRoomResults(message.channel, roomNumber);
        } else {
            const usage = "Usage: [un]advance <roomNumber>\n"
                + "<registration 1>\n"
                + "[...]";
            const lines = message.content.split("\n");

            if (lines.length < 1) {
                await message.channel.send(usage);

                return;
            }

            if (typeof parameters[0] !== "string"
                || !Array.isArray(parameters[0].split("\n"))) {
                await message.channel.send(usage);

                return;
            }

            const roomNumber = Number.parseInt(
                parameters[0].split("\n")[0],
                10,
            );

            if (!Number.isSafeInteger(roomNumber)) {
                await message.channel.send(usage);

                return;
            }

            if (!rounds.has(currentRoundNumber)) {
                await message.channel.send(
                    "Round "
                    + currentRoundNumber
                    + " has not been initialized.",
                );

                return;
            }

            if (!rounds.has(currentRoundNumber + 1)) {
                rounds.set(
                    currentRoundNumber + 1,
                    {
                        hostTeams: [],
                        nonHostTeams: [],
                        advancementsByRoom: new Map(),
                        advancementCount: null,
                    },
                );
            }

            if (command === "advance") {
                await advance(message.channel, roomNumber, lines.slice(1));
            } else if (command === "unadvance") {
                await unadvance(message.channel, roomNumber, lines.slice(1));
            }
        }
    },
};
