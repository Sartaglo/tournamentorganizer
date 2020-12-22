# Tournament Organizer 1.0

This is a Discord bot (Tournament Organizer#7975) designed to ameliorate the
process of running a Mario Kart Wii tournament in Mogi Lounge
(https://discord.gg/HkbxJAM).

## Commands

Commands are executed by mentioning the bot and then providing the command and
any parameters as needed.

`,initialize <documentId> <teamSize> <hostCount> <nonHostCount>
[blacklistedPlayer,...]`

Loads registrations from the identified Google Doc according to the parameters.
Issues a warning about registrations that contain any of the blacklisted
players, provided as a comma-separated list.

`,rooms`

Randomly generates rooms for the current round, choosing the best number of
rounds corresponding to the number of players and team size that divides evenly
into a final room.

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

- [ ] Check manual registrations for duplicates or banned players.
- [ ] Warn about the host registration of hostbanned players.
- [ ] Restore bot state from files.
