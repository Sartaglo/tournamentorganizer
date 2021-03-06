# Tournament Organizer 2.0

This is a Discord bot (TO Bot#7975) designed to ameliorate the
process of running a Mario Kart Wii tournament in Mogi Lounge
(https://discord.gg/HkbxJAM).

## Bot Commands

Commands are executed by providing the command and any parameters as needed.

`,open <#registrationChannelId> <registrationDocumentId> <teamSize>`

Starts watching the identified channel for users registering, updating existing
registrations, and unregistering. Registrations are validated against the
provided team size and stored in the identified Google Doc.

`,close`

Stops watching the channel identified on open.

`,initialize <documentId> <teamSize> <hostCount> <nonHostCount>
[blacklistedPlayer,...]`

Loads registrations from the identified Google Doc according to the parameters.
Issues a warning about registrations that contain any of the blacklisted
players, provided as a comma-separated list.

`,rooms [roomCount advancementCount]`

Randomly generates rooms for the current round, choosing the best number of
rounds corresponding to the number of players and team size that divides evenly
into a final room. If room count and advancement count are provided then it will
generate that many rooms and expect to advance that many *players* (not teams)
instead.

`,round <roundNumber>`

Switches to the identified round, mainly so that next round's rooms can be
generated and teams can start being advanced from that round.

```
,advance <roomNumber>
<registration>
[...]
```

Adds the given teams, each on its own line, in the identified room to next
round, so that they will be part of next round's next room generation.

```
,unadvance <roomNumber>
<registration>
[...]
```

Removes the given teams, each on its own line, in the identified room from next
round, so that they will not be part of next round's next room generation.

`,results <roundNumber>`

Displays the current advancements for the identified room in the current round.

`,status`

Displays how many rooms are done in the current round and lists the rooms that
aren't done.

`,blacklist [add|remove <blacklistedPlayer>,[...]]`

Adds to, removes from, or lists the players banned from the next tournament.
Note that this blacklist is independent of the list provided to `initialize`
that applies to the current tournament.

## Registration Commands

`!c Your Mii Name, Teammate 1 Lounge name, Teammate 1 Mii Name, Teammate 2
Lounge Name, Teammate 2 Mii Name`

Registers your team as a non-hosting team. If you are already registered in a
team, it will replace that registration.

`!ch Your Mii Name, Teammate 1 Lounge name, Teammate 1 Mii Name, Teammate 2
Lounge Name, Teammate 2 Mii Name`

Registers your team as a hosting team. If you are already registered in a team,
it will replace that registration.

`!d`

Unregisters your team.

## Version 1.0 Roadmap

- [x] A `status` command to provide a summary of rooms in the current round,
specifically how many rooms have the expected number of advancements and which
rooms do not.
- [x] The implementation of a simpler command prefix than mentioning.
- [x] Configuration of the bot to respond to tournament organizers.
- [x] Restructuring of the bot to support running it headless on a server.
- [x] Warn about a team being advanced in a room they were not in.
- [x] Prevent a team from being advanced more than once in the same round.
- [x] Warn about the registration of banned players.
- [x] Keeping track of banned players.
- [x] The ability to register or unregister a team after initialization.

## Version 2.0 Roadmap

- [x] Update the list of permitted roles for tournament organization (Boss,
HTRTA, LTRTA, HTCTA, LTCTA).
- [x] Split up `act-on-message.js` and manage state per Discord channel.
- [x] Implement a command for players to manage their own registrations,
including the ability to update the content of their registration and the
ability to unregister.

## Version 3.0 Roadmap

- [x] Support a more readable format in the registration document.
- [x] Store friend codes with host registrations.
- [ ] Manage Tournament Host role.
- [ ] Support existing registrants to easily swap between hosting and
non-hosting without copying and pasting their existing registration.
- [ ] Facilitate the ability to create a category and channels for a new
tournament, automating role creation and setup of permissions.
- [ ] Restore bot state from files.
- [ ] Automatically advance everyone in a room if the room has no more players
than the advancement count.
- [ ] Check manual registrations for duplicates or banned players.
- [ ] Warn about the host registration of hostbanned players.
- [ ] Reject asterisks, underscores, and colons in registrations to avoid issues
with Discord emojis and formatting.
