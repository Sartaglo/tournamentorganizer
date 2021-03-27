"use strict";

const { google } = require("googleapis");
const { actOnRegistration } = require("./act-on-registration");
const { addToBlacklist } = require("./add-to-blacklist");
const { advance } = require("./advance");
const { getRoomResults } = require("./get-room-results");
const { getRoundStatus } = require("./get-round-status");
const { initialize } = require("./initialize");
const { loadCensoredRegexes } = require("./load-censored-regexes");
const { makeRooms } = require("./make-rooms");
const { openRegistrations } = require("./open-registrations");
const { registerHost } = require("./register-host");
const { registerNonHost } = require("./register-non-host");
const { removeFromBlacklist } = require("./remove-from-blacklist");
const { sendBlacklistMessage } = require("./send-blacklist-message");
const { setRoundNumber } = require("./set-round-number");
const { unadvance } = require("./unadvance");
const { unregister } = require("./unregister");

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

const states = new Map();

const registrations = [];

let timeout = null;

const actOnRegistrations = async () => {
    if (registrations.length === 0) {
        timeout = setTimeout(
            () => {
                actOnRegistrations();
            },
            1000,
        );

        return;
    }

    const cachedRegistrations = registrations.slice();

    while (cachedRegistrations.length > 0) {
        const { message, state } = cachedRegistrations.shift();
        registrations.shift();
        await actOnRegistration(adminId, oAuth2Client, message, state);
    }

    timeout = setTimeout(
        () => {
            actOnRegistrations();
        },
        1000,
    );
};

actOnRegistrations();

exports.actOnMessage = async (message) => {
    const authorisAdmin = message.author.id === adminId;

    if (!message.guild && !authorisAdmin) {
        return;
    }

    const entry = Array
        .from(states)
        .find(
            ([_, state]) => message.channel.id === state.registrationChannelId,
        );

    if (typeof entry !== 'undefined') {
        registrations.push({ message, state: entry[1] });

        return;
    }

    const roles = [
        "Boss",
        "CT Admin",
        "Higher Tier RT Arbitrator",
        "Lower Tier RT Arbitrator",
        "Higher Tier CT Arbitrator",
        "Lower Tier CT Arbitrator",
        "Admin",
        "Moderators",
        "Tournament Organizers",
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

    if (message.guild && !states.has(message.channel.id)) {
        states.set(
            message.channel.id,
            {
                allHostTeams: [],
                allNonHostTeams: [],
                currentTeamSize: 1,
                unitName: "team",
                currentRoundNumber: 1,
                rounds: new Map(),
                blacklist: [],
                censoredRegex: null,
            },
        );
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
                    "https://www.googleapis.com/auth/documents",
                ],
            }
        );
        await admin.send(authorizationUrl);

        if (message.guild) {
            await message.channel.send("Sent authorization URL.");
        }
    } else if (commandWithoutPrefix === "authenticate") {
        if (!authorisAdmin || message.guild) {
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
    } else if (commandWithoutPrefix === "guilds") {
        if (!authorisAdmin || message.guild) {
            return;
        }

        try {
            const guilds = Array.from(message.client.guilds.cache.values());
            await message.channel.send(
                "I am in the following guild"
                + (guilds.length === 1 ? "" : "s")
                + ":\n"
                + guilds
                    .map((guild) => guild.name + " (" + guild.id + ")")
                    .join("\n"),
            );
        } catch (error) {
            console.error(error.stack);
            await admin.send(error.stack);
        }
    } else if (commandWithoutPrefix === "leave") {
        if (!authorisAdmin || message.guild) {
            return;
        }

        const guildId = parameters[0];

        if (typeof guildId !== "string" || guildId.length === 0) {
            await admin.send("**Usage:** ,leave <guildId>");

            return;
        }

        try {
            const guild = await message.client.guilds.fetch(
                guildId,
                false,
                true,
            );
            await guild.leave();
            await admin.send(
                "I am no longer in " + guild.name + " (" + guild.id + ").",
            );
        } catch (error) {
            console.error(error.stack);
            await admin.send(error.stack);
        }
    } else if (commandWithoutPrefix === "load") {
        if (!authorisAdmin || !message.guild) {
            return;
        }

        await loadCensoredRegexes(
            message.channel,
            states.get(message.channel.id),
            true,
        );
    } else if (commandWithoutPrefix === "open") {
        if (!authorisAdmin || !message.guild) {
            return;
        }

        const state = states.get(message.channel.id);

        if (typeof state.registrationChannelId === "string") {
            await message.channel.send(
                "I am already watching <#" + state.registrationChannelId + ">.",
            );

            return;
        }

        const usage = "**Usage:** ,open"
            + " <registrationChannel>"
            + " <documentId>"
            + " <teamSize>"
            + " [hostRoleId[ playerRoleId]]";

        if (parameters.length === 0) {
            await message.channel.send(usage);

            return;
        }

        const result = parameters[0].match(/^<#([0-9]+)>$/);
        const registrationDocumentId = parameters[1];
        const teamSize = Number.parseInt(parameters[2]);
        const hostRoleId = parameters.length > 3 ? parameters[3].trim() : null;
        const playerRoleId = parameters.length > 4
            ? parameters[4].trim()
            : null;

        if (!Array.isArray(result)
            || result.length !== 2
            || typeof registrationDocumentId !== "string"
            || registrationDocumentId.length === 0
            || !Number.isInteger(teamSize)
            || teamSize < 1) {
            await message.channel.send(usage);

            return;
        }

        await loadCensoredRegexes(message.channel, state, false);
        const registrationChannelId = result[1];
        await openRegistrations(
            message.channel,
            state,
            registrationChannelId,
            registrationDocumentId,
            teamSize,
            hostRoleId,
            playerRoleId,
        );
    } else if (commandWithoutPrefix === "close") {
        if (!authorisAdmin || !message.guild) {
            return;
        }

        const state = states.get(message.channel.id);

        if (typeof state.registrationChannelId !== "string") {
            await message.channel.send("I am not watching any channel.");

            return;
        }

        const registrationChannelId = state.registrationChannelId;
        delete state.registrationChannelId;
        await message.channel.send(
            "I am no longer watching <#" + registrationChannelId + ">.",
        );
    } else if (commandWithoutPrefix === "initialize") {
        if (!message.guild) {
            return;
        }

        const state = states.get(message.channel.id);

        if (typeof state.registrationChannelId === "string") {
            await message.channel.send(
                "I am still watching <#" + state.registrationChannelId + ">.",
            );

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
            adminId,
            oAuth2Client,
            message.channel,
            state,
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
            await registerHost(
                message.channel,
                states.get(message.channel.id),
                registration,
            );
        } else {
            await registerNonHost(
                message.channel,
                states.get(message.channel.id),
                registration,
            );
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
            await message.channel.send("**Usage:** unregister <registration>");

            return;
        }

        await unregister(
            message.channel,
            states.get(message.channel.id),
            registration,
        );
    } else if (commandWithoutPrefix === "round") {
        if (!message.guild) {
            return;
        }

        const roundNumber = Number.parseInt(parameters[0], 10);

        if (!Number.isSafeInteger(roundNumber)) {
            await message.channel.send("**Usage:** ,round <roundNumber>");

            return;
        }

        await setRoundNumber(
            message.channel,
            states.get(message.channel.id),
            roundNumber,
        );
    } else if (commandWithoutPrefix === "rooms") {
        if (!message.guild) {
            return;
        }

        const roomCount = Number.parseInt(parameters[0], 10);
        const hasRoomCount = Number.isInteger(roomCount);
        const advancementCount = Number.parseInt(parameters[1], 10);
        const hasAdvancementCount = Number.isInteger(advancementCount);

        if ((hasRoomCount && !hasAdvancementCount)
            || (!hasRoomCount && hasAdvancementCount)) {
            await message.channel.send(
                "**Usage:** ,rooms [roomCount advancementCount]",
            );

            return;
        }

        await makeRooms(
            message.channel,
            states.get(message.channel.id),
            roomCount,
            advancementCount,
        );
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

        const state = states.get(message.channel.id);

        if (!state.rounds.has(state.currentRoundNumber)) {
            await message.channel.send(
                "Round "
                + state.currentRoundNumber
                + " has not been initialized.",
            );

            return;
        }

        if (!state.rounds.has(state.currentRoundNumber + 1)) {
            state.rounds.set(
                state.currentRoundNumber + 1,
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
            await advance(message.channel, state, roomNumber, registrations);
        } else if (commandWithoutPrefix === "unadvance") {
            await unadvance(message.channel, state, roomNumber, registrations);
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

        await getRoomResults(
            message.channel,
            states.get(message.channel.id),
            roomNumber,
        );
    } else if (commandWithoutPrefix === "status") {
        if (!message.guild) {
            return;
        }

        await getRoundStatus(message.channel, states.get(message.channel.id));
    } else if (commandWithoutPrefix === "blacklist") {
        if (!message.guild) {
            return;
        }

        const usage =
            "**Usage:** ,blacklist [add|remove <blacklistedPlayer>,[...]]";
        const state = states.get(message.channel.id);
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
                await addToBlacklist(message.channel, state, names);
            } else {
                await removeFromBlacklist(message.channel, state, names);
            }
        } else if (parameters.length === 0) {
            await sendBlacklistMessage(message.channel, state);
        } else {
            await message.channel.send(usage);
        }
    } else if (commandWithoutPrefix === "stop") {
        if (!authorisAdmin) {
            return;
        }

        clearTimeout(timeout);
        await message.channel.send("Goodbye.");
        message.client.destroy();
    }
};
