"use strict";

const { Client } = require("discord.js");
const { actOnMessage } = require("./act-on-message");

module.exports = {
    runBot: async () => {
        const client = new Client();
        client.once(
            "ready",
            () => {
                console.debug("Ready!");
            },
        );
        client.on(
            "message",
            async (message) => {
                await actOnMessage(client, message);
            },
        );

        try {
            await client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error(error);
            client.destroy();
        }
    },
};
