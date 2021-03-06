"use strict";

const { tryGetChannel } = require("./try-get-channel");

exports.openRegistrations = async (
    messageChannel,
    state,
    registrationChannelId,
    registrationDocumentId,
    teamSize,
    hostRoleName,
) => {
    const channel = await tryGetChannel(
        messageChannel.client,
        registrationChannelId,
    );

    if (channel === null) {
        await messageChannel.send(
            "**Error**: Invalid channel <#" + registrationChannelId + ">",
        );

        return;
    }

    if (messageChannel.id === registrationChannelId) {
        await messageChannel.send("I cannot watch this same channel.");

        return;
    }

    state.botChannelId = messageChannel.id;
    state.registrationChannelId = registrationChannelId;
    state.registrationDocumentId = registrationDocumentId;
    state.currentTeamSize = teamSize;
    state.hostRoleName = hostRoleName;
    await messageChannel.send(
        "I am now watching <#" + registrationChannelId + ">.",
    );
};
