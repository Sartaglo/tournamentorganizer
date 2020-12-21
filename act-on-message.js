"use strict";

const fs = require("fs");
const { google } = require("googleapis");
const { shuffle } = require("./shuffle");

const adminId = "484822486861611011";

const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
);
oAuth2Client.setCredentials(
    {
        access_token: process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        scope: process.env.GOOGLE_SCOPE,
        token_type: process.env.GOOGLE_TOKEN_TYPE,
        expiry_date: process.env.GOOGLE_EXPIRY_DATE,
    },
);

let allHostTeams = [];

let allNonHostTeams = [];

let currentTeamSize = 1;

let unitName = "team";

let currentRoundNumber = 1;

let rounds = new Map();

let blacklist = [];

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
        registration: registration === null
            ? null
            : registration.trim().replace(/\s+/g, " "),
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
    blacklist,
) => {
    google.docs({ version: "v1", auth: oAuth2Client }).documents.get(
        { documentId },
        async (error, response) => {
            if (error) {
                console.error("Error using Google Docs:", error.stack);
                await channel.send(
                    "An error was encountered with Google Docs. The error has"
                    + " been reported to <@"
                    + adminId
                    + ">.",
                );
                const admin = await channel.client.users.fetch(
                    adminId,
                    false,
                    true,
                );
                await admin.send(error.stack);

                return;
            }

            allHostTeams = [];
            allNonHostTeams = [];
            currentTeamSize = teamSize;
            unitName = teamSize === 1 ? "player" : "team";
            currentRoundNumber = 1;
            const messages = [];
            const content = response.data.body.content;
            let contentIndex = 0;

            while (allHostTeams.length < hostCount
                && contentIndex < content.length) {
                const { registration, nextIndex } = parseRegistration(
                    content,
                    contentIndex,
                );

                if (registration === null) {
                    messages.push(
                        "**Error:** A blank host registration was encountered."
                        + " Check the number of "
                        + unitName
                        + "s specified.",
                    );
                } else if (!registration.match(/^\s*$/)) {
                    allHostTeams.push(registration);
                }

                contentIndex = nextIndex;
            }

            contentIndex = findNextRegistration(content, contentIndex);

            while (allNonHostTeams.length < nonHostCount
                && contentIndex < content.length) {
                const { registration, nextIndex } = parseRegistration(
                    content,
                    contentIndex,
                );

                if (registration === null) {
                    messages.push(
                        "**Warning:** A blank non-host registration was"
                        + " encountered. Check the document and the number of "
                        + unitName
                        + "s specified.",
                    );
                } else if (!registration.match(/^\s*$/)) {
                    allNonHostTeams.push(registration);
                }

                contentIndex = nextIndex;
            }

            const blacklistedTeams = [];
            const allTeams = allHostTeams.concat(allNonHostTeams);
            allTeams.forEach(
                (outerTeam, outerIndex) => {
                    if (outerTeam.length === 0) {
                        return;
                    }

                    const outer = outerTeam.toLowerCase();
                    const serverNameRegex =
                        /\[([A-Za-z0-9]{2,15})\]|\(([A-Za-z0-9]{2,15})\)/g;
                    const serverNames = Array
                        .from(outer.matchAll(serverNameRegex))
                        .map((match) => match[1])
                        .filter(
                            (match) => typeof match === "string"
                                && match.length > 1,
                        );

                    if (blacklist.some((item) => serverNames.includes(item))) {
                        blacklistedTeams.push(outerTeam);
                    }

                    if (outerIndex < hostCount) {
                        if (!outer.includes("can host")) {
                            messages.push(
                                "**Warning:** `"
                                + outerTeam
                                + "` will be treated as a host registration."
                                + " Check the document and the number of "
                                + unitName
                                + "s specified for any discrepancies.",
                            );
                        }
                    } else {
                        if (outer.includes("can host")) {
                            messages.push(
                                "**Warning:** `"
                                + outerTeam
                                + "` will be treated as a non-host"
                                + " registration. Check the document and the"
                                + " number of "
                                + unitName
                                + "s specified for any discrepancies.",
                            );
                        }
                    }

                    const friendCodeRegex =
                        /\(([0-9]{4}-[0-9]{4}-[0-9]{4})\)|\[([0-9]{4}-[0-9]{4}-[0-9]{4})\]/g;
                    const friendCodes = Array
                        .from(outer.matchAll(friendCodeRegex))
                        .map((match) => match[1])
                        .filter(
                            (match) => typeof match === "string"
                                && match.length > 1,
                        );
                    const outerSegments = serverNames.concat(friendCodes);
                    allTeams
                        .slice(outerIndex + 1)
                        .forEach(
                            (innerTeam) => {
                                if (innerTeam.length === 0) {
                                    return;
                                }

                                const inner = innerTeam.toLowerCase();
                                const innerSegments = Array
                                    .from(inner.matchAll(serverNameRegex))
                                    .concat(
                                        Array.from(
                                            inner.matchAll(friendCodeRegex),
                                        ),
                                    )
                                    .map((match) => match[1])
                                    .filter(
                                        (match) => typeof match === "string"
                                            && match.length > 1,
                                    );
                                const outerIncludesInner = outerSegments.some(
                                    (match) => innerSegments.includes(match),
                                );
                                const innerIncludesOuter = innerSegments.some(
                                    (match) => outerSegments.includes(match),
                                );

                                if (outerIncludesInner
                                    || innerIncludesOuter
                                    || outer.includes(inner)
                                    || inner.includes(outer)) {
                                    messages.push(
                                        "**Warning:** The following"
                                        + " registrations could be duplicates"
                                        + " of one another:"
                                        + "\n`"
                                        + outerTeam
                                        + "`\n`"
                                        + innerTeam
                                        + "`",
                                    );
                                }
                            },
                        );
                }
            );

            if (blacklistedTeams.length > 0) {
                messages.push(
                    "**Warning:** The following registrations could be on the"
                    + " blacklist:"
                    + blacklistedTeams
                        .map((team) => "\n`" + team + "`")
                        .join(''),
                );
            }

            rounds = new Map();
            rounds.set(
                1,
                {
                    hostTeams: allHostTeams.slice(),
                    nonHostTeams: allNonHostTeams.slice(),
                    advancementsByRoom: new Map(),
                    advancementCount: null,
                    rooms: [],
                },
            );
            const fileName = "initialize-output.txt";
            saveRound(1);
            const baseContent = "Initialization complete.";
            const extraContent = messages.join("\n");
            const files = ["round-1-hosts.txt", "round-1-non-hosts.txt"];

            if (baseContent.length + 1 + extraContent.length > 2000) {
                fs.writeFileSync(fileName, messages.join("\r\n") + "\r\n");
                files.unshift(fileName);
                await channel.send(
                    baseContent
                    + " Check `"
                    + fileName
                    + "` for additional output.",
                    { files },
                );
            } else {
                await channel.send(
                    [baseContent, ...messages].join("\n"),
                    { files },
                );
            }
        }
    );
};

const registerHost = async (channel, registration) => {
    if (allHostTeams.includes(registration)) {
        await channel.send("That is already a host registration.");
    }

    if (allNonHostTeams.includes(registration)) {
        await channel.send("That is already a non-host registration.");
    }

    allHostTeams.push(registration);
    await channel.send(
        "`" + registration + "` is now registered as a host " + unitName + ".",
    );
};

const registerNonHost = async (channel, registration) => {
    if (allHostTeams.includes(registration)) {
        await channel.send("That is already a host registration.");
    }

    if (allNonHostTeams.includes(registration)) {
        await channel.send("That is already a non-host registration.");
    }

    allNonHostTeams.push(registration);
    await channel.send(
        "`"
        + registration
        + "` is now registered as a non-host "
        + unitName
        + ".",
    );
};

const unregister = async (channel, registration) => {
    const hostIndex = allHostTeams.findIndex(
        (hostTeam) => hostTeam === registration,
    );

    if (hostIndex !== -1) {
        allHostTeams.splice(hostIndex, 1);
        await channel.send(
            "`" + registration + "` is no longer a host registration.",
        );
    }

    const nonHostIndex = allNonHostTeams.findIndex(
        (nonHostTeam) => nonHostTeam === registration,
    );

    if (nonHostIndex !== -1) {
        allNonHostTeams.splice(nonHostIndex, 1);
        await channel.send(
            "`" + registration + "` is no longer a non-host registration.",
        );
    }

    if (hostIndex === -1 && nonHostIndex === -1) {
        await channel.send("`" + registration + "` is not registered.");
    }
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
                rooms: [],
            },
        );
    }

    currentRoundNumber = roundNumber;
    await channel.send("Switched to round " + roundNumber + ".");
}

const sendUpdate = async (
    channel,
    action,
    nextRound,
    roomNumber,
    hostTeams,
    nonHostTeams,
    messages,
    advancementsByRoom,
    advancementCount,
) => {
    const teamCount = nextRound.hostTeams.length
        + nextRound.nonHostTeams.length;
    const baseContent = action
        + " "
        + hostTeams.length
        + " host "
        + unitName
        + (hostTeams.length === 1 ? "" : "s")
        + " and "
        + nonHostTeams.length
        + " non-host "
        + unitName
        + (nonHostTeams.length === 1 ? "" : "s")
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
        + (advancementCount === 1 ? "" : "s")
        + ". Round "
        + (currentRoundNumber + 1)
        + " now has "
        + nextRound.hostTeams.length
        + " host "
        + unitName
        + (nextRound.hostTeams.length === 1 ? "" : "s")
        + " and "
        + nextRound.nonHostTeams.length
        + " non-host "
        + unitName
        + (nextRound.nonHostTeams.length === 1 ? "" : "s")
        + " for a total of "
        + teamCount
        + " "
        + unitName
        + (teamCount === 1 ? "" : "s")
        + ".";
    const extraContent = messages.join("\n");

    if (baseContent.length + 1 + extraContent.length > 2000) {
        const fileName = action.toLowerCase().slice(0, action.length - 1)
            + "-output.txt";
        fs.writeFileSync(fileName, messages.join("\r\n") + "\r\n");
        await channel.send(
            baseContent
            + " Check `"
            + fileName
            + "` for additional output.",
            { files: [fileName] },
        );
    } else {
        await channel.send([baseContent, ...messages].join("\n"));
    }
}

const advanceTeams = (roomNumber, teams) => {
    const currentRound = rounds.get(currentRoundNumber);
    const nextRound = rounds.get(currentRoundNumber + 1);
    const hostTeams = [];
    const nonHostTeams = [];
    const messages = [];
    teams.forEach(
        (team) => {
            const inAllHostTeams = allHostTeams.indexOf(team) !== -1;
            const inNextHostTeams = nextRound.hostTeams.indexOf(team) !== -1;
            const inAllNonHostTeams = allNonHostTeams.indexOf(team) !== -1;
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
                        + currentRoundNumber
                        + ".",
                    );
                }
            } else {
                messages.push(
                    "**Warning:** `"
                    + team
                    + "` was not in a room of round "
                    + currentRoundNumber
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
                        + (currentRoundNumber + 1)
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
                        + (currentRoundNumber + 1)
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
    saveRound(currentRoundNumber + 1);

    return { hostTeams, nonHostTeams, messages };
};

const advance = async (channel, roomNumber, teams) => {
    const currentRound = rounds.get(currentRoundNumber);

    if (!currentRound.advancementsByRoom.has(roomNumber)) {
        await channel.send(
            "Room "
            + roomNumber
            + " of round "
            + currentRoundNumber
            + " has not been initialized.",
        );

        return;
    }

    const {
        hostTeams,
        nonHostTeams,
        messages,
    } = advanceTeams(roomNumber, teams);
    await sendUpdate(
        channel,
        "Advanced",
        rounds.get(currentRoundNumber + 1),
        roomNumber,
        hostTeams,
        nonHostTeams,
        messages,
        currentRound.advancementsByRoom,
        currentRound.advancementCount,
    );
};

const unadvanceTeams = (roomNumber, teams) => {
    const nextRound = rounds.get(currentRoundNumber + 1);
    const advancements =
        rounds.get(currentRoundNumber).advancementsByRoom.get(roomNumber);
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
                    + (currentRoundNumber + 1)
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
                    + (currentRoundNumber + 1)
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
    saveRound(currentRoundNumber + 1);

    return { hostTeams, nonHostTeams, messages };
};

const unadvance = async (channel, roomNumber, teams) => {
    const currentRound = rounds.get(currentRoundNumber);

    if (!currentRound.advancementsByRoom.has(roomNumber)) {
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
        messages,
    } = unadvanceTeams(roomNumber, teams);
    await sendUpdate(
        channel,
        "Unadvanced",
        nextRound,
        roomNumber,
        hostTeams,
        nonHostTeams,
        messages,
        currentRound.advancementsByRoom,
        currentRound.advancementCount,
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
        return { roomCount: 1, advancementCount: currentTeamSize };
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
    const fileName = "round-" + currentRoundNumber + "-rooms.txt";
    fs.writeFileSync(fileName, roomTexts.join("\r\n\r\n"));
    const advancingTeamCount = advancementCount / currentTeamSize;
    const pluralizer = advancingTeamCount === 1 ? "" : "s";
    await channel.send(
        "Room generation complete. "
        + (advancingTeamCount === 1
            ? ("The winning "
                + unitName
                + " of this room is the winner of the tournament.")
            : ("Advance the top "
                + advancingTeamCount
                + " "
                + unitName
                + pluralizer
                + " in each room.")),
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

const getRoundStatus = async (channel) => {
    if (!rounds.has(currentRoundNumber)) {
        await channel.send(
            "Round " + currentRoundNumber + " has not been initialized.",
        );

        return;
    }

    const {
        advancementsByRoom,
        advancementCount,
    } = rounds.get(currentRoundNumber);

    if (advancementsByRoom.size === 0 || advancementCount === null) {
        await channel.send(
            "Rooms have not been made for round " + currentRoundNumber + ".",
        );

        return;
    }

    const advancingTeamCount = advancementCount / currentTeamSize;
    const notDoneRoomNumbers = Array.from(advancementsByRoom)
        .filter(
            ([_, advancements]) => advancements.length !== advancingTeamCount,
        )
        .map(([roomNumber]) => roomNumber);

    const countIndicator = (notDoneRoomNumbers.length === 1 ? " is" : "s are");
    await channel.send(
        "Round "
        + currentRoundNumber
        + " has "
        + (advancementsByRoom.size - notDoneRoomNumbers.length)
        + " out of "
        + advancementsByRoom.size
        + " rooms with "
        + advancingTeamCount
        + "/"
        + advancingTeamCount
        + " "
        + unitName
        + (advancingTeamCount === 1 ? "" : "s")
        + " advanced"
        + "."
        + (notDoneRoomNumbers.length === 0
            ? ""
            : (" The following room"
                + countIndicator
                + " not done: "
                + notDoneRoomNumbers.reduce(
                    (accumulator, roomNumber, index, self) => {
                        if (self.length === 2) {
                            return accumulator + " and " + roomNumber;
                        }

                        if (index < self.length - 1) {
                            return accumulator + ", " + roomNumber;
                        }

                        return accumulator + ", and " + roomNumber;
                    },
                )
                + "."
            )
        ),
        { files: ["round-" + currentRoundNumber + "-rooms.txt"] },
    );
}

const sendBlacklistMessage = async (channel) => {
    await channel.send(
        blacklist.length === 0
            ? "No players are banned for the next tournament."
            : ("The following "
                + blacklist.length
                + " player"
                + (blacklist.length === 1 ? " is" : "s are")
                + " banned from the next tournament: "
                + blacklist.join(", ")),
    );
}

const addToBlacklist = async (channel, names) => {
    names.forEach(
        (name) => {
            if (blacklist.includes(name)) {
                return;
            }

            blacklist.push(name);
        },
    );
    await sendBlacklistMessage(channel);
};

const removeFromBlacklist = async (channel, names) => {
    names.forEach(
        (name) => {
            const index = blacklist.findIndex(
                (item) => item.toLowerCase().replace(/\s+/g, "")
                    === name.toLowerCase().replace(/\s+/g, ""),
            );

            if (index === -1) {
                return;
            }

            blacklist.splice(index, 1);
        },
    );
    await sendBlacklistMessage(channel);
};

const clearBlacklist = async (channel) => {
    blacklist = [];
    await sendBlacklistMessage(channel);
}

module.exports = {
    actOnMessage: async (message) => {
        const authorisAdmin = message.author.id === adminId;

        if (!message.guild && !authorisAdmin) {
            return;
        }

        const roles = [
            "Boss",
            "Higher Tier Arbitrator",
            "Lower Tier Arbitrator",
            "Custom Track Arbitrator",
        ];

        if (!authorisAdmin
            && !roles.includes(message.member.roles.highest.name)) {
            return;
        }

        const segments = message.content.replace(/ +/g, " ").split(" ");
        const prefix = ",";

        if (segments.length < 1 || !segments[0].startsWith(prefix)) {
            return;
        }

        const [command, ...parameters] = segments;
        const commandWithoutPrefix = command.substring(prefix.length);
        const admin = await message.client.users.fetch(
            adminId,
            false,
            true,
        );

        if (commandWithoutPrefix === "read") {
            if (!authorisAdmin) {
                return;
            }

            const usage = "**Usage:** ,read <fileName> [...]";

            if (parameters.some(
                (parameter) => typeof parameter !== "string"
                    || parameter.length === 0,
            )) {
                if (message.guild) {
                    await message.channel.send(usage);
                } else {
                    await admin.send(usage);
                }

                return;
            }

            try {
                if (message.guild) {
                    await message.channel.send(null, { files: parameters });
                } else {
                    await admin.send(null, { files: parameters });
                }
            } catch (error) {
                console.error(error.stack);
                await admin.send(error.stack);
            }
        } else if (commandWithoutPrefix === "authorize") {
            if (!authorisAdmin) {
                return;
            }

            const authorizationUrl = oAuth2Client.generateAuthUrl(
                {
                    access_type: "offline",
                    scope: [
                        "https://www.googleapis.com/auth/documents.readonly",
                    ],
                }
            );
            await admin.send(authorizationUrl);

            if (message.guild) {
                await message.channel.send("Sent authorization URL.");
            }
        } else if (commandWithoutPrefix === "authenticate") {
            if (message.guild || !authorisAdmin) {
                return;
            }

            const code = parameters[0];

            if (typeof code !== "string" || code.length === 0) {
                await admin.send("**Usage:** ,authenticate <accessCode>");

                return;
            }

            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                await admin.send("```JSON\n"
                    + JSON.stringify(tokens, null, 2)
                    + "\n```");
            } catch (error) {
                console.error("Error authenticating:", error.stack);
                await admin.send(error.stack);
            }
        } else if (commandWithoutPrefix === "initialize") {
            if (!message.guild) {
                return;
            }

            const documentId = parameters[0];
            const teamSize = Number.parseInt(parameters[1], 10);
            const hostCount = Number.parseInt(parameters[2], 10);
            const nonHostCount = Number.parseInt(parameters[3], 10);
            const blacklist = parameters
                .slice(4)
                .join(" ")
                .split(",")
                .map((item) => item.trim().toLowerCase());

            if (typeof documentId !== "string"
                || documentId.length === 0
                || ![1, 2, 3].includes(teamSize)
                || !Number.isSafeInteger(hostCount)
                || !Number.isSafeInteger(nonHostCount)) {
                await message.channel.send(
                    "**Usage:** ,initialize"
                    + " <documentId> <teamSize> <hostCount> <nonHostCount>"
                    + " [blacklistedPlayer,...]",
                );

                return;
            }

            await initialize(
                message.channel,
                documentId,
                teamSize,
                hostCount,
                nonHostCount,
                blacklist,
            );
        } else if (commandWithoutPrefix === "register") {
            if (!message.guild) {
                return;
            }

            const usage = "**Usage:** register host|nonhost <registration>";
            const type = parameters[0];

            if (type !== "host" && type !== "nonhost") {
                await message.channel.send(usage);

                return;
            }

            const registration = parameters
                .slice(1)
                .join(" ")
                .trim()
                .replace(/\s+/g, " ");

            if (registration.length === 0) {
                await message.channel.send(usage);

                return;
            }

            if (type == "host") {
                await registerHost(message.channel, registration);
            } else {
                await registerNonHost(message.channel, registration);
            }
        } else if (commandWithoutPrefix === "unregister") {
            if (!message.guild) {
                return;
            }

            const registration = parameters
                .join(" ")
                .trim()
                .replace(/\s+/g, " ");

            if (registration.length === 0) {
                await message.channel.send(
                    "**Usage:** unregister <registration>",
                );

                return;
            }

            await unregister(message.channel, registration);
        } else if (commandWithoutPrefix === "round") {
            if (!message.guild) {
                return;
            }

            const roundNumber = Number.parseInt(parameters[0], 10);

            if (!Number.isSafeInteger(roundNumber)) {
                await message.channel.send("**Usage:** ,round <roundNumber>");

                return;
            }

            await setRoundNumber(message.channel, roundNumber);
        } else if (commandWithoutPrefix === "rooms") {
            if (!message.guild) {
                return;
            }

            await makeRooms(message.channel);
        } else if (commandWithoutPrefix === "advance"
            || commandWithoutPrefix === "unadvance") {
            if (!message.guild) {
                return;
            }

            const usage = "**Usage:** ,[un]advance <roomNumber>\n"
                + "<registration>\n"
                + "[...]";
            const registrations = message.content
                .split("\n")
                .slice(1)
                .filter(
                    (registration, index, self) =>
                        self.indexOf(registration) === index,
                );

            if (registrations.length < 1) {
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
                        rooms: [],
                    },
                );
            }

            if (commandWithoutPrefix === "advance") {
                await advance(message.channel, roomNumber, registrations);
            } else if (commandWithoutPrefix === "unadvance") {
                await unadvance(message.channel, roomNumber, registrations);
            }
        } else if (commandWithoutPrefix === "results") {
            if (!message.guild) {
                return;
            }

            const roomNumber = Number.parseInt(parameters[0], 10);

            if (!Number.isSafeInteger(roomNumber)) {
                await message.channel.send("**Usage:** ,results <roomNumber>");

                return;
            }

            await getRoomResults(message.channel, roomNumber);
        } else if (commandWithoutPrefix === "status") {
            if (!message.guild) {
                return;
            }

            await getRoundStatus(message.channel);
        } else if (commandWithoutPrefix === "blacklist") {
            if (!message.guild) {
                return;
            }

            const usage =
                "**Usage:** ,blacklist [add|remove <blacklistedPlayer>,[...]]";
            const subCommand = parameters[0];

            if (subCommand === "add" || subCommand === "remove") {
                const names = parameters
                    .slice(1)
                    .join(" ")
                    .split(",")
                    .map((item) => item.trim());

                if (names.length === 0) {
                    await message.channel.send(usage);
                } else if (names.some(
                    (name) => !(/^[A-Za-z0-9 ]{2,15}$/).test(name),
                )) {
                    await message.channel.send(
                        "A player's name consists of 2-15 alphanumeric or space"
                        + " characters.",
                    );
                } else if (subCommand === "add") {
                    await addToBlacklist(message.channel, names);
                } else {
                    await removeFromBlacklist(message.channel, names);
                }
            } else if (parameters.length === 0) {
                await sendBlacklistMessage(message.channel);
            } else {
                await message.channel.send(usage);
            }
        } else if (commandWithoutPrefix === "stop") {

            if (!authorisAdmin) {
                return;
            }

            await message.channel.send("Goodbye.");
            message.client.destroy();
        }
    },
};
