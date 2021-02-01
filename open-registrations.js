"use strict";

const { tryGetChannel } = require("./try-get-channel");

exports.openRegistrations = async (
    messageChannel,
    state,
    registrationChannelId,
    registrationDocumentId,
) => {
    const channel = await tryGetChannel(messageChannel, registrationChannelId);

    if (channel === null) {
        await messageChannel.send(
            "**Error**: Invalid channel <#" + registrationChannelId + ">",
        );

        return;
    }

    state.botChannelId = messageChannel.id;
    state.registrationChannelId = registrationChannelId;
    state.registrationDocumentId = registrationDocumentId;
    await messageChannel.send(
        "I am now watching <#" + registrationChannelId + ">.",
    );
};
