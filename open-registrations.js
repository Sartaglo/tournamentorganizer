"use strict";

const { tryGetChannel } = require("./try-get-channel");

exports.openRegistrations = async (
    messageChannel,
    state,
    registrationChannelId,
    registrationDocumentId,
    teamSize,
    hostRoleId,
    playerRoleId,
) => {
    const channel = await tryGetChannel(
        messageChannel.client,
        messageChannel,
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
    state.hostRoleId = hostRoleId;
    state.playerRoleId = playerRoleId;
    await messageChannel.send(
        "I am now watching <#" + registrationChannelId + ">.",
    );
};
