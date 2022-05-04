"use strict";

const { Role, Guild } = require("discord.js");
const { getFriendCode } = require("./get-friend-code");
const { sendOutput } = require("./send-output");
const { tryGetChannel } = require("./try-get-channel");
const { tryGetDocument } = require("./try-get-document");
const { updateDocument } = require("./update-document");

const invalidRoleNames = [
    "Regular Tracks",
    "Custom Tracks",
    "All Tracks",
    "Unverified",
    "Muted",
];

const listItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return "";
    }

    if (items.length === 1) {
        return items[0];
    }

    if (items.length === 2) {
        return items[0] + " and " + items[1];
    }

    return items
        .map(
            (item, index, self) => index === self.length - 1
                ? ("and " + item)
                : item,
        )
        .join(", ");
};

const sanitizeWhitespace = (input) => input.replace(/[ \t]+/g, " ").trim();

const sanitizeUnicode = (input) => Array
    .from(input)
    .map(
        (character) => character.charCodeAt(0) >= 0xE000
            ? ("0x" + character.charCodeAt(0).toString(16).toLocaleUpperCase())
            : character,
    ).join("");

const stringsEqual = (first, second) => {
    if (typeof first !== "string" && typeof second !== "string") {
        return true;
    }

    if (
        (typeof first === "string" && typeof second !== "string")
        || (typeof first !== "string" && typeof second === "string")
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
                content: sanitizeWhitespace(element.textRun.content),
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

const isCan = (registrationContent) => {
    const content = registrationContent.toLocaleUpperCase();

    return content.startsWith("!C")
        && !content.startsWith("!CH")
        && !content.startsWith("!CANH");
};

const isCanHost = (registrationContent) => {
    const content = registrationContent.toLocaleUpperCase();

    return content.startsWith("!CH") || content.startsWith("!CANH");
};

const isDrop = (registrationContent) =>
    registrationContent.toLocaleUpperCase().startsWith("!D");

const getFormatError = (teamSize, content, canHost) => {
    if (!Number.isInteger(teamSize) || teamSize <= 0) {
        return "Expected `" + content + "` to be in the correct format.";
    }

    return "Expected `"
        + content
        + "` to be in the following format: `"
        + (canHost ? "XXXX-XXXX-XXXX (host) " : "")
        + (
            teamSize === 1
                ? ("Mii name [Lounge name]")
                : Array(teamSize)
                    .fill("")
                    .map(
                        (_, index) => "Player "
                            + (index + 1)
                            + " Mii name [Player "
                            + (index + 1)
                            + " Lounge name]",
                    )
                    .join(" ")
        )
        + "`.";
}

const isValidLoungeName = (loungeName) =>
    (/^[A-Za-z0-9 ]{2,15}$/).test(loungeName);

const parseDocumentRegistration = (guildId, teamSize, content, canHost) => {
    const registrationRegex = new RegExp(
        "^"
        + (canHost ? "[0-9]{4}-[0-9]{4}-[0-9]{4} \\(host\\) " : "")
        + Array(teamSize)
            .fill("")
            .map(() => "(.+) [\\(\\[]([^\\]]+)[\\)\\]]")
            .join(" ")
        + "$",
    );

    const match = content.match(registrationRegex);

    if (match === null) {
        return {
            messages: [getFormatError(teamSize, content, canHost)],
            players: []
        };
    }

    const segments = match.slice(1);

    if (segments.length !== teamSize * 2) {
        return {
            messages: [getFormatError(teamSize, content, canHost)],
            players: []
        };
    }

    const messages = [];
    const players = [];
    segments.forEach(
        (segment, index) => {
            const sanitizedSegment = segment.trim().length === 0
                ? " "
                : segment.trim();

            if (index % 2 === 1) {
                // MC Nation (896025772207259688)
                if (!isValidLoungeName(sanitizedSegment) && guildId !== '896025772207259688') {
                    messages.push(
                        "Expected `"
                        + sanitizedSegment
                        + "` to be a valid Lounge name "
                        + "(2-15 letters/numbers/spaces).",
                    );

                    return;
                }

                players.push({ loungeName: sanitizedSegment });

                return;
            }

            if (sanitizedSegment.length === 0) {
                messages.push(
                    "Expected `"
                    + sanitizedSegment
                    + "` to be a valid Mii name (1-10 characters).",
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

const parseDocumentRegistrations = async (channel, teamSize, content) => {
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

            const result = parseDocumentRegistration(
                channel.guild instanceof Guild ? channel.guild.id : null,
                teamSize,
                listItem.content.trim(),
                hosts.includes(listItem),
            );
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
        nextHostIndex: hostListEndIndex - 1,
        hostListEndsWithBlank: hosts[hosts.length - 1].content.length === 0,
        nextNonHostIndex: nonHostListEndIndex - 1,
        nonHostListEndsWithBlank: nonHosts[nonHosts.length - 1].content.length
            === 0,
    };
};

const parseRegistrationContent = (teamSize, registrationContent) => {
    if (teamSize === 1) {
        return [registrationContent];
    }

    if (registrationContent.includes("\n")) {
        if (registrationContent.includes(",")) {
            return registrationContent
                .split("\n")
                .reduce(
                    (segments, line, index) => {
                        const lineSegments = line.split(",");

                        if (index === 0) {
                            return [...segments, lineSegments[0]];
                        }

                        return [...segments, lineSegments[0], lineSegments[1]];
                    },
                    [],
                );
        }

        const multiLineBracketRegex = new RegExp(
            "^"
            + Array(teamSize)
                .fill("")
                .map(
                    (_, index) => index === 0
                        ? "(.+?)(?: [\\(\\[][^\\]]+[\\)\\]])?"
                        : "(.+) [\\(\\[]([^\\]]+)[\\)\\]]",
                )
                .join("\n")
            + "$",
        );
        const multiLineMatch = registrationContent.match(multiLineBracketRegex);

        if (multiLineMatch === null) {
            return [];
        }

        return multiLineMatch.slice(1);
    }

    if (registrationContent.includes(",")) {
        const segments = registrationContent.split(",");

        if (segments.length === teamSize * 2) {
            segments.splice(1, 1);
        }

        return segments;
    }

    const singleLineBracketRegex = new RegExp(
        "^"
        + Array(teamSize)
            .fill("")
            .map(
                (_, index) => index === 0
                    ? "(.+) [\\(\\[][^\\]]+[\\)\\]]"
                    : "(.+) [\\(\\[]([^\\]]+)[\\)\\]]",
            )
            .join(" ")
        + "$",
    );
    const singleLineMatch = registrationContent.match(singleLineBracketRegex);

    if (singleLineMatch === null) {
        return [];
    }

    return singleLineMatch.slice(1);
}

const getDeleteContentRange = (
    registrations,
    existingRegistration,
    insertingAfter,
) => {
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
                startIndex: (isLatestRegistration && !isLastRegistrationOfType)
                    || (isLastRegistrationOfType && insertingAfter)
                    ? (existingRegistration.startIndex - 1)
                    : existingRegistration.startIndex,
                endIndex: isLatestRegistration || isLastRegistrationOfType
                    ? (existingRegistration.endIndex - 1)
                    : existingRegistration.endIndex
            }
        }
    };
}

const removeRoles = async (
    hostRole,
    playerRole,
    message,
    existingRegistrations,
) => {
    if (!(hostRole instanceof Role)
        || !message.guild.me.hasPermission("MANAGE_ROLES")) {
        return;
    }

    if (hostRole instanceof Role) {
        await message.member.roles.remove(hostRole);
    }

    if (playerRole instanceof Role) {
        await message.member.roles.remove(playerRole);
    }

    for (const registration of existingRegistrations) {
        for (const player of registration.players) {
            const members = await message.guild.members.fetch(
                { query: player.loungeName, limit: 1000, force: true }
            );
            const member = members.find(
                (member) => stringsEqual(member.displayName, player.loungeName)
                    && !invalidRoleNames.includes(member.roles.highest.name)
                    && !member.user.bot
            );

            if (typeof member === "undefined") {
                continue;
            }

            if (hostRole instanceof Role) {
                await member.roles.remove(hostRole);
            }

            if (playerRole instanceof Role) {
                await member.roles.remove(playerRole);
            }
        }
    }
}

exports.actOnRegistration = async (adminId, oAuth2Client, message, state) => {
    const registrationContent = sanitizeWhitespace(message.content);
    const canHost = isCanHost(registrationContent);
    const dropping = isDrop(registrationContent);

    if (!isCan(registrationContent) && !canHost && !dropping) {
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

    const result = await parseDocumentRegistrations(
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

    const segments = dropping
        ? []
        : parseRegistrationContent(
            state.currentTeamSize,
            registrationContent.split(" ").slice(1).join(" "),
        )
            .map((segment) => sanitizeWhitespace(segment));
    const registrantName = sanitizeWhitespace(message.member.displayName);
    const teammateNames = segments.filter(
        (_, index) => index > 0 && index % 2 === 0,
    );
    const loungeNames = [registrantName, ...teammateNames];

    if (
        teammateNames.some((segment) => stringsEqual(segment, registrantName))
    ) {
        await message.channel.send(
            "<@"
            + message.author.id
            + "> You must put yourself first in the registration.",
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

        return;
    }

    if (!dropping && segments.length !== (state.currentTeamSize * 2) - 1) {
        const command = canHost ? "!ch" : "!c";
        await message.channel.send(
            "<@"
            + message.author.id
            + "> You must register in the following format:`"
            + command
            + " Your Mii name [Your Lounge name] "
            + Array(state.currentTeamSize - 1)
                .fill("")
                .map(
                    (_, index) => "Teammate "
                        + (index + 1)
                        + " Mii name [Teammate "
                        + (index + 1)
                        + " Lounge name]",
                )
                .join(" ")
            + "`.",
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

        return;
    }

    const registrantIsRegistered = result.registrations.some(
        (registration) => registration.players.some(
            (player) => stringsEqual(player.loungeName, registrantName),
        ),
    );
    const duplicateLoungeName = loungeNames.find(
        (loungeName, index) => loungeNames
            .slice(index + 1)
            .some((name) => stringsEqual(name, loungeName)),
    );

    if (typeof duplicateLoungeName === "string") {
        await message.channel.send(
            "<@"
            +
            message.author.id
            + "> The Lounge name `"
            + duplicateLoungeName
            + "` appears more than once.",
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

        return;
    }

    const invalidLoungeNames = [];

    for (
        let teammateIndex = 0;
        teammateIndex < teammateNames.length;
        teammateIndex += 1
    ) {
        const teammateName = teammateNames[teammateIndex];
        const members = await message.guild.members.fetch(
            { query: teammateName, limit: 1000, force: true },
        );
        const member = members.find(
            (member) => stringsEqual(member.displayName, teammateName)
                && !invalidRoleNames.includes(member.roles.highest.name)
                && !member.user.bot,
        );

        if (typeof member === "undefined") {
            invalidLoungeNames.push(teammateName);

            continue;
        }

        loungeNames.splice(teammateIndex + 1, 1, member.displayName);
    }

    if (invalidLoungeNames.length > 0) {
        await message.channel.send(
            "<@"
            + message.author.id
            + "> "
            + listItems(invalidLoungeNames.map((name) => "`" + name + "`"))
            + " "
            + (
                invalidLoungeNames.length === 1
                    ? "is not the display name of any non-bot user that is"
                    : "are not the display names of any non-bot users that are"
            )
            + " not muted, verified, and currently in this server.",
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

        return;
    }

    const miiNames = segments.filter(
        (_, index) => index === 0 || index % 2 === 1,
    );
    const invalidMiiNames = miiNames
        .filter(
            (miiName) => miiName < 1
                || miiName.length > 10
                || (state.censoredRegex instanceof RegExp
                    && state.censoredRegex.test(miiName)),
        )
        .map(
            (miiName) => state.censoredRegex instanceof RegExp
                ? miiName.replace(
                    state.censoredRegex,
                    (match) => Array(match.length).fill("*").join(''),
                )
                : miiName,
        );

    if (invalidMiiNames.length > 0) {
        await message.channel.send(
            "<@"
            + message.author.id
            + "> "
            + listItems(
                invalidMiiNames.map(
                    (name) => "`" + (name.length > 0 ? name : " ") + "`",
                ),
            )
            + " "
            + (
                invalidMiiNames.length === 1
                    ? "is an invalid Mii name"
                    : "are invalid Mii names"
            )
            + ".",
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

        return;
    }

    const hostRole = await message.guild.roles.fetch(
        state.hostRoleId,
        false,
        true,
    );
    const playerRole = await message.guild.roles.fetch(
        state.playerRoleId,
        false,
        true,
    );
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

            try {
                await message.react("❌");
            } catch (error) {
                console.error(error);
                await message.channel.send("❌");
            }

            return;
        }

        await removeRoles(hostRole, playerRole, message, existingRegistrations);
        await updateDocument(
            adminId,
            message.client,
            oAuth2Client,
            state,
            document.revisionId,
            [
                getDeleteContentRange(
                    result.registrations,
                    existingRegistration,
                    false,
                ),
            ],
        );

        try {
            await message.react("✅");
        } catch (error) {
            console.error(error);
            await message.channel.send("✅");
        }

        return;
    }

    const duplicateMiiNames = miiNames.filter(
        (miiName) => result.registrations.some(
            (registration) => registration !== existingRegistration
                && registration.players.some(
                    (player) => stringsEqual(
                        player.miiName,
                        sanitizeUnicode(miiName),
                    ),
                ),
        ),
    );

    if (duplicateMiiNames.length > 0) {
        await message.channel.send(
            "<@"
            +
            message.author.id
            + "> The Mii name"
            + (duplicateMiiNames.length === 1 ? "" : "s")
            + " "
            + listItems(duplicateMiiNames.map((name) => "`" + name + "`"))
            + " "
            + (duplicateMiiNames.length === 1 ? "is" : "are")
            + " taken.",
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

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
            message.author.id
            + "> "
            + listItems(names)
            + " "
            + (
                names.length === 1
                    ? "is already registered on a different team."
                    : "are already registered on different teams."
            ),
        );

        try {
            await message.react("❌");
        } catch (error) {
            console.error(error);
            await message.channel.send("❌");
        }

        return;
    }

    await removeRoles(
        hostRole,
        playerRole,
        message,
        existingRegistrations,
        invalidRoleNames,
    );
    const friendCode = await getFriendCode(message.author.id);

    if (canHost) {
        if (friendCode === null) {
            await message.channel.send(
                "<@"
                +
                message.author.id
                + "> you must set a friend code with `^setfc` in Lounge"
                + " before registering as a host.",
            );

            try {
                await message.react("❌");
            } catch (error) {
                console.error(error);
                await message.channel.send("❌");
            }

            return;
        }

        if (hostRole instanceof Role
            && message.guild.me.hasPermission("MANAGE_ROLES")) {
            await message.member.roles.add(hostRole);
        }
    }

    if (playerRole instanceof Role
        && message.guild.me.hasPermission("MANAGE_ROLES")) {
        for (const loungeName of loungeNames) {
            const members = await message.guild.members.fetch(
                { query: loungeName, limit: 1000, force: true }
            );
            const member = members.find(
                (member) => stringsEqual(member.displayName, loungeName)
                    && !invalidRoleNames.includes(member.roles.highest.name)
                    && !member.user.bot
            );

            if (typeof member === "undefined") {
                continue;
            }

            await member.roles.add(playerRole);
        }
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
                + (canHost ? (friendCode + " (host) ") : "")
                + miiNames
                    .map(
                        (miiName, index) => sanitizeUnicode(
                            miiName
                            + " ["
                            + loungeNames[index]
                            + "]",
                        ),
                    )
                    .join(" "),
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
            existingRegistration,
            existingRegistration.canHost === canHost
        );

        if (deleteRequest.deleteContentRange.range.startIndex
            > insertRequest.insertText.location.index) {
            deleteRequest.deleteContentRange.range.startIndex +=
                insertRequest.insertText.text.length;
            deleteRequest.deleteContentRange.range.endIndex +=
                insertRequest.insertText.text.length;
        }

        await updateDocument(
            adminId,
            message.client,
            oAuth2Client,
            state,
            document.revisionId,
            [insertRequest, deleteRequest],
        );
    }

    try {
        await message.react("✅");
    } catch (error) {
        console.error(error);
        await message.channel.send("✅");
    }
};
