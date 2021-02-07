"use strict";

const { google } = require("googleapis");

exports.tryGetDocument = (adminId, oAuth2Client, documentId) => new Promise(
    (resolve) => {
        google.docs({ version: "v1", auth: oAuth2Client }).documents.get(
            { documentId },
            async (error, response) => {
                if (error) {
                    console.error("Error using Google Docs:", error.stack);
                    await channel.send(
                        "An error was encountered with Google Docs. The error"
                        + " has been reported to <@"
                        + adminId
                        + ">.",
                    );
                    const admin = await channel.client.users.fetch(
                        adminId,
                        false,
                        true,
                    );
                    await admin.send(error.stack);
                    resolve(null);

                    return;
                }

                resolve(response.data);
            },
        );
    },
);
