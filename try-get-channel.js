"use strict";

exports.tryGetChannel = async (discordClient, channelId) => {
    try {
        return await discordClient.channels.fetch(channelId, false, true);
    } catch (error) {
        console.error(error.stack);
        await channel.send(usage);

        return null;
    }
}
