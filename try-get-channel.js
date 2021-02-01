"use strict";

exports.tryGetChannel = async (channel, channelId) => {
    try {
        return await channel.client.channels.fetch(
            channelId,
            false,
            true,
        );
    } catch (error) {
        console.error(error.stack);
        await channel.send(usage);

        return null;
    }
}
