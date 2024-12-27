"use strict";

const { google } = require("googleapis");
const { tryGetChannel } = require("./try-get-channel");

exports.updateDocument = (
    adminId,
    discordClient,
    botChannel,
    oAuth2Client,
    state,
    requiredRevisionId,
    requests,
) => new Promise(
    (resolve) => {
        google
            .docs({ version: "v1", auth: oAuth2Client })
            .documents
            .batchUpdate(
                {
                    documentId: state.registrationDocumentId,
                    requestBody: {
                        requests,
                        writeControl: { requiredRevisionId }
                    }
                },
                async (error) => {
                    if (error) {
                        console.error("Error using Google Docs:", error.stack);
                        const channel = await tryGetChannel(
                            discordClient,
                            botChannel,
                            state.botChannelId,
                        );

                        if (channel === null) {
                            return;
                        }

                        await channel.send(
                            "An error was encountered with Google Docs. The"
                            + " error has been reported to <@"
                            + adminId
                            + ">.",
                        );
                        const admin = await channel.client.users.fetch(
                            adminId,
                            false,
                            true,
                        );
                        await admin.send(error.stack);

                        return;
                    }

                    resolve();
                },
            );
    },
);
