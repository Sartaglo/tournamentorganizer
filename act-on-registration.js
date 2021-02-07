"use strict";

const { sendOutput } = require("./send-output");
const { tryGetChannel } = require("./try-get-channel");
const { tryGetDocument } = require("./try-get-document");
const { updateDocument } = require("./update-document");

const separator = ", ";

const listItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return "";
    }

    if (items.length === 1) {
        return items[0];
    }

    if (items.length === 2) {
        return items[0] + ' and ' + items[1];
    }

    return items
        .map(
            (item, index, self) => index === self.length - 1
                ? ('and ' + item)
                : item,
        )
        .join(', ');
};

const sanitizeInput = (input) => input.replace(/\s+/g, " ").trim();

const stringsEqual = (first, second) => {
    if (typeof first !== 'string' && typeof second !== 'string') {
        return true;
    }

    if (
        (typeof first === 'string' && typeof second !== 'string')
        || (typeof first !== 'string' && typeof second === 'string')
    ) {
        return false;
    }

    return first
        .replace(/\s+/g, "")
        .toLocaleLowerCase()
        .localeCompare(second.replace(/\s+/g, "").toLocaleLowerCase()) === 0;
};

const parseListItem = (paragraph) => {
    if (
        typeof paragraph !== "object"
        || paragraph === null
        || !Array.isArray(paragraph.elements)
    ) {
        return null;
    }

    return paragraph.elements
        .filter(
            (element) => typeof element === "object"
                && element !== null
                && typeof element.textRun === "object"
                && element.textRun !== null,
        )
        .map(
            (element) => ({
                startIndex: element.startIndex,
                endIndex: element.endIndex,
                content: sanitizeInput(element.textRun.content),
            }),
        )
        .reduce(
            (listItem, element) => {
                const startIndex = listItem.startIndex === -1
                    ? element.startIndex
                    : Math.min(listItem.startIndex, element.startIndex);
                const endIndex = listItem.endIndex === -1
                    ? element.endIndex
                    : Math.max(listItem.endIndex, element.endIndex);

                return {
                    startIndex,
                    endIndex,
                    content: element.content.length === 0
                        ? listItem.content
                        : (listItem.content + " " + element.content),
                };
            },
            { startIndex: -1, endIndex: -1, content: "" },
        );
};

const getFormatError = (teamSize, content) => {
    if (!Number.isInteger(teamSize) || teamSize <= 0) {
        return "Expected `" + content + "` to be in the correct format.";
    }

    return "Expected `"
        + content
        + "` to be in the following format: `"
        + (
            teamSize === 1
                ? ("Lounge name" + separator + "Mii name")
                : Array(teamSize)
                    .fill("")
                    .map(
                        (_, index) => "Player "
                            + (index + 1)
                            + " Mii name"
                            + separator
                            + "Player "
                            + (index + 1)
                            + " Lounge name",
                    )
                    .join(separator)
        )
        + "`.";
}

const isValidLoungeName = (loungeName) =>
    (/^[A-Za-z0-9 ]{2,15}$/).test(loungeName);

const isValidMiiName = (miiName) => typeof miiName === "string"
    && miiName.length <= 10;

const parseRegistration = (teamSize, content) => {
    if (!content.includes(",")) {
        return { messages: [getFormatError(teamSize, content)], players: [] };
    }

    const segments = content.split(",");

    if (segments.length !== teamSize * 2) {
        return { messages: [getFormatError(teamSize, content)], players: [] };
    }

    const messages = [];
    const players = [];
    segments.forEach(
        (segment, index) => {
            const sanitizedSegment = segment.trim().length === 0
                ? " "
                : segment.trim();

            if (index % 2 === 0) {
                if (!isValidLoungeName(sanitizedSegment)) {
                    messages.push(
                        "Expected `"
                        + sanitizedSegment
                        + "` to be a valid Lounge name.",
                    );

                    return;
                }

                players.push({ loungeName: sanitizedSegment });

                return;
            }

            if (!isValidMiiName(sanitizedSegment)) {
                messages.push(
                    "Expected `"
                    + sanitizedSegment
                    + "` to be a valid Mii name.",
                );

                return;
            }

            const player = players[Math.floor(index / 2)];

            if (typeof player !== "object" || player === null) {
                return;
            }

            player.miiName = sanitizedSegment;
        },
    );

    return { messages, players };
};

const parseRegistrations = async (channel, teamSize, content) => {
    const hosts = [];
    const nonHosts = [];
    let hostListId = null;
    let hostListEndIndex = null;
    let nonHostListId = null;
    let nonHostListEndIndex = null;

    for (let index = 0; index < content.length; index += 1) {
        const paragraph = content[index].paragraph;

        if (typeof paragraph === "undefined"
            || paragraph.elements.length === 0
            || typeof paragraph.bullet === "undefined") {
            continue;
        }

        if (hostListId === null) {
            hostListId = paragraph.bullet.listId;
        } else if (paragraph.bullet.listId !== hostListId
            && nonHostListId === null) {
            nonHostListId = paragraph.bullet.listId;
        }

        const listItem = parseListItem(paragraph);

        if (hostListId !== null && nonHostListId === null) {
            if (listItem !== null) {
                hosts.push(listItem);
            }

            hostListEndIndex = paragraph
                .elements[paragraph.elements.length - 1]
                .endIndex;
        } else if (nonHostListId !== null) {
            if (listItem !== null) {
                nonHosts.push(listItem);
            }

            nonHostListEndIndex = paragraph
                .elements[paragraph.elements.length - 1]
                .endIndex;
        }
    }

    if (
        hostListId === null
        || hostListEndIndex === null
        || nonHostListId === null
        || nonHostListEndIndex === null
    ) {
        await channel.send(
            "**Error**: Registration document does not contain a list of hosts"
            + " and a list of non-hosts.",
        );

        return null;
    }

    const messages = [];
    const registrations = [];
    hosts.concat(nonHosts).forEach(
        (listItem) => {
            if (listItem === null || listItem.content.length === 0) {
                return;
            }

            const result = parseRegistration(teamSize, listItem.content);
            messages.push(...result.messages);

            if (result.players.length !== teamSize) {
                return;
            }

            registrations.push(
                {
                    startIndex: listItem.startIndex,
                    endIndex: listItem.endIndex,
                    players: result.players,
                    canHost: hosts.includes(listItem),
                },
            );
        },
    );

    return {
        messages,
        registrations,
        hostListEndsWithBlank: hosts[hosts.length - 1].content.length === 0,
        nextHostIndex: hostListEndIndex - 1,
        nextNonHostIndex: nonHostListEndIndex - 1,
        nonHostListEndsWithBlank: nonHosts[nonHosts.length - 1].content.length
            === 0,
    };
};

const getDeleteContentRange = (registrations, existingRegistration) => {
    const isLatestRegistration = registrations.indexOf(existingRegistration)
        === registrations.length - 1;
    const isLastRegistrationOfType = registrations
        .filter(
            (registration) => registration.canHost
                === existingRegistration.canHost,
        )
        .length
        === 1;

    return {
        deleteContentRange: {
            range: {
                startIndex: isLatestRegistration && !isLastRegistrationOfType
                    ? (existingRegistration.startIndex - 1)
                    : existingRegistration.startIndex,
                endIndex: isLatestRegistration || isLastRegistrationOfType
                    ? (existingRegistration.endIndex - 1)
                    : existingRegistration.endIndex
            }
        }
    };
}

exports.actOnRegistration = async (adminId, oAuth2Client, message, state) => {
    const registrationContent = sanitizeInput(message.content);
    const canHost = registrationContent.startsWith("!ch");
    const dropping = registrationContent.startsWith("!d");

    if (!registrationContent.startsWith("!c") && !canHost && !dropping) {
        return;
    }

    const botChannel = await tryGetChannel(message.client, state.botChannelId);

    if (botChannel === null) {
        console.error(
            "Invalid bot channel ID: " + state.botChannelId,
        );
    }

    const document = await tryGetDocument(
        adminId,
        oAuth2Client,
        botChannel,
        state.registrationDocumentId,
    );

    if (document === null) {
        return;
    }

    const result = await parseRegistrations(
        message.channel,
        state.currentTeamSize,
        document.body.content,
    );

    if (result === null) {
        return;
    }

    if (result.messages.length > 0) {
        const fileName = message.channel.id + "-registration-output.txt";
        await sendOutput(botChannel, "", result.messages, fileName, []);
    }

    const segments = registrationContent.split(" ").slice(1).join(" ").split(",");

    if (!dropping && segments.length !== (state.currentTeamSize * 2) - 1) {
        const command = canHost ? "!ch" : "!c";
        await message.channel.send(
            "<@"
            + message.author.id
            + "> You must register in the following format: `"
            + command
            + " Your Mii name"
            + separator
            + Array(state.currentTeamSize - 1)
                .fill("")
                .map(
                    (_, index) => "Teammate "
                        + (index + 1)
                        + " lounge name"
                        + separator
                        + "Teammate "
                        + (index + 1)
                        + " Mii name",
                )
                .join(separator)
            + "`.",
        );
        await message.react("❌");

        return;
    }

    const registrantName = sanitizeInput(message.member.displayName);
    const registrantIsRegistered = result.registrations.some(
        (registration) => registration.players.some(
            (player) => stringsEqual(player.loungeName, registrantName),
        ),
    );
    const teammateNames = segments
        .filter((_, index) => index % 2 === 1)
        .map((teammateName) => sanitizeInput(teammateName));
    const invalidLoungeNames = [];

    for (const teammateName of teammateNames) {
        const members = await message.guild.members.fetch(
            { query: teammateName, limit: 1000, force: true },
        );
        const unverifiedRoleNames = [
            "Regular Tracks",
            "Custom Tracks",
            "All Tracks",
            "Unverified",
        ];

        if (
            members.every(
                (member) => !stringsEqual(member.displayName, teammateName)
                    || unverifiedRoleNames.includes(member.roles.highest.name)
                    || member.user.bot,
            )
        ) {
            invalidLoungeNames.push(teammateName);
        }
    }

    if (invalidLoungeNames.length > 0) {
        await message.channel.send(
            "<@"
            + message.author.id
            + "> "
            + listItems(invalidLoungeNames.map((name) => '`' + name + '`'))
            + " "
            + (
                invalidLoungeNames.length === 1
                    ? "is not the display name of any non-bot user that is"
                    : "are not the display names of any non-bot users that are"
            )
            + " verified and currently in this server.",
        );
        await message.react("❌");

        return;
    }

    const invalidMiiNames = segments
        .filter((_, index) => index % 2 === 0)
        .map((miiName) => sanitizeInput(miiName))
        .filter((miiName) => miiName.length > 10);

    if (invalidMiiNames.length > 0) {
        await message.channel.send(
            "<@"
            + message.author.id
            + "> "
            + listItems(invalidMiiNames.map((name) => '`' + name + '`'))
            + " "
            + (
                invalidMiiNames.length === 1
                    ? "is an invalid Mii name"
                    : "are invalid Mii names"
            )
            + ".",
        );
        await message.react("❌");

        return;
    }

    const loungeNames = [registrantName, ...teammateNames];
    const existingRegistrations = result.registrations.filter(
        (registration) => registration.players.some(
            (player) => loungeNames.some(
                (loungeName) => stringsEqual(loungeName, player.loungeName),
            ),
        ),
    );
    const existingRegistration = existingRegistrations[0];

    if (dropping) {
        if (typeof existingRegistration === "undefined") {
            await message.channel.send(
                "<@" + message.author.id + "> You are not registered.",
            );
            await message.react("❌");

            return;
        }

        await updateDocument(
            adminId,
            message.client,
            oAuth2Client,
            state,
            document.revisionId,
            [getDeleteContentRange(result.registrations, existingRegistration)],
        );
        await message.react('✅');

        return;
    }

    if ((!registrantIsRegistered && existingRegistrations.length > 0)
        || existingRegistrations.length > 1) {
        const names = existingRegistrations
            .reduce(
                (registeredLoungeNames, registration) => [
                    ...registeredLoungeNames,
                    ...registration.players.map((player) => player.loungeName),
                ],
                []
            )
            .filter(
                (name, index, self) => self.indexOf(name) === index
                    && loungeNames
                        .slice(1)
                        .some((loungeName) => stringsEqual(loungeName, name)),
            );
        await message.channel.send(
            "<@"
            +
            message.author.id + "> "
            + listItems(names)
            + ' '
            + (
                names.length === 1
                    ? 'is already registered on a different team.'
                    : 'are already registered on different teams.'
            ),
        );
        await message.react("❌");

        return;
    }

    const insertRequest = {
        insertText: {
            text: (
                (canHost && !result.hostListEndsWithBlank)
                    || (
                        !canHost
                        && !result.nonHostListEndsWithBlank
                    )
                    ? "\n"
                    : ""
            )
                + registrantName
                + separator
                + segments
                    .map((segment) => sanitizeInput(segment))
                    .join(separator),
            location: {
                index: canHost
                    ? result.nextHostIndex
                    : result.nextNonHostIndex,
            },
        },
    };

    if (typeof existingRegistration === "undefined") {
        await updateDocument(
            adminId,
            message.client,
            oAuth2Client,
            state,
            document.revisionId,
            [insertRequest],
        );
    } else {
        const deleteRequest = getDeleteContentRange(
            result.registrations,
            existingRegistration
        );

        if (insertRequest.insertText.location.index
            > deleteRequest.deleteContentRange.range.startIndex) {
            insertRequest.insertText.location.index -=
                deleteRequest.deleteContentRange.range.endIndex
                - deleteRequest.deleteContentRange.range.startIndex;
        }

        await updateDocument(
            adminId,
            message.client,
            oAuth2Client,
            state,
            document.revisionId,
            [deleteRequest, insertRequest],
        );
    }

    await message.react('✅');
};
