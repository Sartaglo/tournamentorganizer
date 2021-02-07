"use strict";

const { saveRound } = require("./save-round");
const { sendOutput } = require("./send-output");
const { tryGetDocument } = require("./try-get-document");

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

exports.initialize = async (
    adminId,
    oAuth2Client,
    channel,
    state,
    documentId,
    teamSize,
    hostCount,
    nonHostCount,
    blacklist,
) => {
    const document = await tryGetDocument(
        adminId,
        oAuth2Client,
        channel,
        documentId,
    );

    if (document === null) {
        return;
    }

    const content = document.body.content;
    state.allHostTeams = [];
    state.allNonHostTeams = [];
    state.currentTeamSize = teamSize;
    state.unitName = teamSize === 1 ? "player" : "team";
    state.currentRoundNumber = 1;
    const messages = [];
    let contentIndex = 0;

    while (state.allHostTeams.length < hostCount
        && contentIndex < content.length) {
        const { registration, nextIndex } = parseRegistration(
            content,
            contentIndex,
        );

        if (registration === null) {
            messages.push(
                "**Error:** A blank host registration was encountered."
                + " Check the number of "
                + state.unitName
                + "s specified.",
            );
        } else if (!registration.match(/^\s*$/)) {
            state.allHostTeams.push(registration);
        }

        contentIndex = nextIndex;
    }

    contentIndex = findNextRegistration(content, contentIndex);

    while (state.allNonHostTeams.length < nonHostCount
        && contentIndex < content.length) {
        const { registration, nextIndex } = parseRegistration(
            content,
            contentIndex,
        );

        if (registration === null) {
            messages.push(
                "**Warning:** A blank non-host registration was"
                + " encountered. Check the document and the number of "
                + state.unitName
                + "s specified.",
            );
        } else if (!registration.match(/^\s*$/)) {
            state.allNonHostTeams.push(registration);
        }

        contentIndex = nextIndex;
    }

    const blacklistedTeams = [];
    const allTeams = state.allHostTeams.concat(state.allNonHostTeams);
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
                if (!outer.includes("host")) {
                    messages.push(
                        "**Warning:** `"
                        + outerTeam
                        + "` will be treated as a host registration. Check the"
                        + " document and the number of "
                        + state.unitName
                        + "s specified for any discrepancies.",
                    );
                }
            } else {
                if (outer.includes("host")) {
                    messages.push(
                        "**Warning:** `"
                        + outerTeam
                        + "` will be treated as a non-host registration. Check"
                        + " the document and the number of "
                        + state.unitName
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

    state.rounds = new Map();
    state.rounds.set(
        1,
        {
            hostTeams: state.allHostTeams.slice(),
            nonHostTeams: state.allNonHostTeams.slice(),
            advancementsByRoom: new Map(),
            advancementCount: null,
            rooms: [],
        },
    );
    saveRound(channel, state, 1);
    const baseContent = "Initialization complete.";
    const files = [
        channel.id + "-round-1-hosts.txt",
        channel.id + "-round-1-non-hosts.txt",
    ];
    const fileName = channel.id + "-initialize-output.txt";
    await sendOutput(channel, baseContent, messages, fileName, files);
};
