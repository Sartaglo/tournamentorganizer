"use strict";

const fs = require("fs");
const { Client } = require("discord.js");
const { actOnMessage } = require("./act-on-message");

module.exports = {
    runBot: () => {
        return new Promise(
            (resolve, reject) => {
                fs.readFile(
                    "discord-token.json",
                    async (error, token) => {
                        if (error) {
                            reject("Error loading token: " + error);

                            return;
                        }

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
                                await actOnMessage(message);
                            },
                        );
                        await client.login(JSON.parse(token));
                        resolve(
                            () => {
                                client.destroy();
                            },
                        );
                    },
                );
            }
        )
    },
};
