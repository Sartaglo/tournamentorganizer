"use strict";

const { getDocument } = require("./get-document");
const { updateDocument } = require("./update-document");

exports.handleRegistration = async (adminId, oAuth2Client, message, state) => {
    const document = await getDocument(
        adminId,
        oAuth2Client,
        state.registrationDocumentId,
    );
    const content = document.body.content;
    let hostListId = null;
    let hostListEndIndex = null;
    let nonHostListId = null;
    let nonHostListEndIndex = null;

    for (let index = 0; index < content.length; index += 1) {
        const paragraph = content[index].paragraph;

        if (typeof paragraph === "undefined"
            || paragraph.elements.length === 0
            || typeof paragraph.bullet === "undefined") {
            continue;
        }

        if (hostListId === null) {
            hostListId = paragraph.bullet.listId;
        } else if (paragraph.bullet.listId !== hostListId
            && nonHostListId === null) {
            nonHostListId = paragraph.bullet.listId;
        }

        if (hostListId !== null && nonHostListId === null) {
            hostListEndIndex =
                paragraph.elements[paragraph.elements.length - 1].endIndex;
        } else if (nonHostListId !== null) {
            nonHostListEndIndex =
                paragraph.elements[paragraph.elements.length - 1].endIndex;
        }
    }

    if (hostListId === null
        || hostListEndIndex === null
        || nonHostListId === null
        || nonHostListEndIndex === null) {
        await message.channel.send(
            "**Error**: Registration document does not contain a list of hosts"
            + " and a list of non-hosts.",
        );

        return;
    }

    await updateDocument(
        adminId,
        oAuth2Client,
        state,
        document.revisionId,
        [
            {
                insertText: {
                    text: message.content.replace(/\s+/g, " ") + "\n",
                    location: {
                        index: message.content.includes("host")
                            ? (hostListEndIndex - 1)
                            : (nonHostListEndIndex - 1),
                    },
                },
            },
        ],
    );
}
