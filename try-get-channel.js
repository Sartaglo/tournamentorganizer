"use strict";

exports.tryGetChannel = async (discordClient, messageChannel, channelId) => {
    try {
        return await discordClient.channels.fetch(channelId, false, true);
    } catch (error) {
        console.error(error.stack);
        await messageChannel.send(usage);

        return null;
    }
}
