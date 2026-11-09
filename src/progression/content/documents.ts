// All written and spoken story content. The player should be able to piece the
// truth together from these alone, so each one is a voice with its own concerns,
// not an exposition dump.

export type DocumentStyle = 'memo' | 'typed' | 'hand' | 'tape' | 'terminal' | 'log';

export interface DocumentDef {
  id: string;
  title: string;
  style: DocumentStyle;
  /** Shown under the title: who wrote it or where it was found. */
  source: string;
  body: string;
}

const docs: DocumentDef[] = [
  {
    id: 'signal_log',
    title: 'Relay Station Nine: Carrier Log',
    style: 'log',
    source: 'Your own logbook',
    body: `ALPINE RELAY AUTHORITY, STATION NINE
Operator: I. Marek

15 OCT 86, 03:17. Unlogged carrier, 2.4 MHz. Bearing: Hollin Ridge. Lasted four minutes.

16 OCT 86. Same carrier, same time. Telephone to the Institute unanswered. Road closed by early snow, they tell me.

02 NOV 86. Reported. Authority says the Institute is a private concern. Not our problem unless it interferes with traffic.

11 JAN 87. Cleaned up the signal as far as I can. It's a voice. One voice, very degraded. It says the same thing each night:

  "...is ... [static] ... Hollin Ridge. If you can hear ... [static] ... come. Hana ... [static] ... come."

22 JAN 87. No word from Hana since September. Her last letter asked me not to visit in winter.

08 DEC 87. Fourteen months. Nobody else can hear it. I've stopped asking them to try.

Taking the survey truck up as far as it goes. Then I'll walk. She's asking someone to come.`,
  },
  {
    id: 'visitor_log',
    title: 'Visitor Register',
    style: 'hand',
    source: 'Reception desk',
    body: `HOLLIN RIDGE INSTITUTE OF ACOUSTIC SCIENCE
ALL VISITORS MUST SIGN IN AND OUT

10 Oct 86   D. Pelham, Ministry of Works   IN 09:12   OUT 16:40
11 Oct 86   Delivery, cryo. supplies       IN 11:05   OUT 11:30
13 Oct 86   Prof. A. Lindqvist             IN 10:00   OUT 10:55

The rest of the page is empty, except for one line at the bottom. The ink has faded to brown, as old as everything around it.

09 Dec 87   I. Marek   IN 02:51   OUT

That is my handwriting.`,
  },
  {
    id: 'protocol_h',
    title: 'Protocol H (Interim)',
    style: 'memo',
    source: 'Pinned to the noticeboard',
    body: `FROM: T. Brandvold, Night Security
TO: All staff working past 18:00
DATE: 2 October 1986

Dr. Renn has asked me to stop calling this "the quiet" in the logs, so this is Protocol H.

If the sound in a room drops away, and you will know it when it does, follow these steps:

1. STOP.
2. GET LOW. If you have to move, move slowly.
3. DO NOT RUN.
4. DO NOT touch doors, switches or equipment until the sound comes back.

It passes in a minute or two. Nobody has been hurt following this.

It goes toward noise. That's all we know about it. I would ask people to stop going to look.

T.B.`,
  },
  {
    id: 'staff_bulletin',
    title: 'Staff Bulletin No. 212',
    style: 'memo',
    source: 'Pinned to the noticeboard',
    body: `HOLLIN RIDGE STAFF BULLETIN, OCTOBER 1986

CANTEEN: Hot meals end at 19:00 from Monday. Apologies to the night shift.

ROAD: The lower road will close at first heavy snow. Last supply run is 17 October. Please send your post before then.

CLOCKS: Facilities has been asked why the corridor clocks keep losing time. Facilities has no answer at present.

HEADPHONES: Would whoever keeps taking headsets from Level C please return them. We are now down to six.

LISTENING SESSIONS: Dr. Marek reminds all staff that attendance in the Annex is voluntary. She would like that understood.`,
  },
  {
    id: 'memo_code',
    title: 'Memo from the Director',
    style: 'memo',
    source: 'Administration office',
    body: `FROM: Dr. L. Renn, Director
TO: Administrative staff
RE: Records room

I have now found the records room code written on three separate desk blotters.

The code has been changed. It is now the year this Institute first opened its doors. You have all walked past the plaque in the lobby every day for years, so I will not be repeating this by telephone.

Personnel files do not leave that room.

L.R.`,
  },
  {
    id: 'director_letter',
    title: 'Letter to the Ministry (Unsent)',
    style: 'typed',
    source: "Director's desk",
    body: `Dr. L. Renn
Hollin Ridge Institute
12 October 1986

Dear Pelham,

You asked me on Friday what exactly the Ministry has been paying for. I gave you the answer we agreed on. Here is the true one.

Dr. Marek's team has established that the quartz seam beneath this mountain retains vibration, the way a tape retains a signal. Sound soaks into the rock and stays there. With sufficient isolation it can be played back. We have heard the 1931 avalanche. We have heard the men who cut the first road singing.

That is what Annex C is for. It is the quietest room on Earth, and the staff have taken to calling it the Silent Annex. It's only in that silence that one can hear what the rock has kept.

I am writing because of Test 41. On that night we heard Dr. Olander ask for a cup of coffee, in the corridor, in his own voice.

He asked for it the following morning, in the same words.

I don't believe the rock has only kept the past.

I will not be sending this letter.

L. Renn`,
  },
  {
    id: 'personnel_marek',
    title: 'Personnel File: Marek, H.',
    style: 'typed',
    source: 'Records room, cabinet M',
    body: `NAME: Marek, Hana Dr.
POST: Head of Geophonics
JOINED: March 1979
CLEARANCE: Grade 2, Level C

NEXT OF KIN: Ilse Marek (sister). Radio technician, Alpine Relay Authority, Station Nine.

NOTES:
Sep 86: Dr. Marek requests that all her outgoing post be held for review by her personally. Unusual. Granted.

Oct 86: Dr. Marek has asked that if any member of her family contacts the Institute, they be told to stay away. She would not explain and became upset when asked.

(Paper-clipped: her spare access card, signed out and never returned.)`,
  },
  {
    id: 'night_log_1',
    title: 'Security Night Log (September)',
    style: 'hand',
    source: 'Under the reception desk',
    body: `T. BRANDVOLD. NIGHTS.

19 Sep. 02:40. Dr. Dragan reports someone in Level C with a hand torch. Checked. Nobody. All doors locked.

24 Sep. 03:05. Same report, different person. Small light moving in the lab corridor, seen through the glass. Went up. Nobody.

27 Sep. 03:10. Saw it myself on the camera. Figure, walking, not fast. One of ours? Can't make out the face. Something on its back and a long thin line rising off one shoulder like a fishing rod. Went to the corridor. Nobody, and it was very quiet up there.

I mean QUIET. I couldn't hear my own boots.

29 Sep. The staff are calling it the Visitor. I've told them to stop.`,
  },
  {
    id: 'research_notes',
    title: 'Notes on the Residual',
    style: 'hand',
    source: 'Research room bench',
    body: `The seam doesn't record. I keep using that word and it keeps being wrong.

A recording has an order: before, during, after. The Residual has none of that. When we isolate it, what comes out is everything that has ever happened here, or that ever will. It isn't sorted. We hear whatever is loudest.

Olander's coffee wasn't a prophecy. It was just very close to the surface.

Things that get repeated get louder. Anything said here over and over cuts a deeper groove.

So what's the loudest thing in the mountain?

Test 44 will run with all dampers closed, at the deepest gain we've ever tried. I want to find out what we've been hearing underneath everything else.

H.M.`,
  },
  {
    id: 'tape_olander',
    title: 'Tape: Olander, Lab Notes',
    style: 'tape',
    source: 'Reel deck, research room',
    body: `[TAPE HISS]

OLANDER: Sixth of October. Hana wants me to say for the record that I objected. So. For the record.

We have a carrier in the Residual now, about two point four megahertz, which shouldn't be possible. It's a radio frequency in solid rock. It has a voice on it. A woman.

MAREK: (off-mic) Piet, it's nothing yet.

OLANDER: It's something. Hana won't play it for me any more. She played it once, and she went white, and she went home and wrote a letter.

MAREK: Turn it off, please.

[TAPE ENDS]`,
  },
  {
    id: 'aune_note',
    title: 'Note from K. Aune, Electrician',
    style: 'hand',
    source: 'Clipped to Board 2',
    body: `Whoever gets to this after me. Board 2 feeds the whole research wing and the lift. I've pulled F3, it's blown, and the spares are locked up in the equipment store. Key's in the research room, ask Dragan, she keeps it in her lab coat.

Once you've got a new 30A in F3, you'll need to set the breakers before you throw the lever:

The WEST bus has a dead short somewhere past the canteen. If it's closed when you energise it takes the board down with it. Leave it.

RESERVE is a dead line. The feed from the valley never came back. It won't power anything. And don't have it closed along with MAIN, because the two will fight and you'll trip.

So everything has to come in on MAIN. The research wing and the lift hang off the EAST bus.

Work it out, it isn't hard. Then pull the lever.

K. Aune, 14/10

P.S. Don't hang about up here at night.`,
  },
  {
    id: 'night_log_2',
    title: 'Security Night Log (October)',
    style: 'hand',
    source: 'Equipment store',
    body: `T. BRANDVOLD. NIGHTS.

8 Oct. The Visitor again, Level C corridor, on camera 4. It stopped under the lens and stood there. It carries a small light, held low. Orange coat, I think. Hard to tell on the monitor.

11 Oct. It's getting clearer. Every time it's clearer. That's what I can't get anyone to take seriously. It's as though someone keeps turning up the contrast.

13 Oct. It's a woman. She's not doing anything. She walks through the building opening things and looking at things. She reads the notices. I watched her read Protocol H.

14 Oct. Dr. Marek came to the security room at midnight and asked to see the footage. She watched it through twice and then she thanked me, very politely, and asked me to go home.

I'm not going home. The road's bad, and she's got everyone going down to the Annex tonight anyway.`,
  },
  {
    id: 'test44_log',
    title: 'Test 44: Observation Log',
    style: 'typed',
    source: 'Observation room console',
    body: `TEST No.:     44
DATE:         14 October 1986
PROGRAMME:    Geophonic (Deep Listening)
OBSERVER:     P. Olander
LEAD:         H. Marek
ATTENDANCE:   41 (ALL STAFF, VOLUNTARY)
LOCATION:     Annex C

23:40  Chamber sealed. Dampers closed. Gain at maximum.
00:15  Staff seated. Headsets on. Silence.
01:30  Carrier strong. Marek says keep going.
02:50  I can't see the Annex feed any more, only the rings of chairs. No one is moving.
03:02  Nobody answers on the intercom.
03:10  I can hear it in here now, without a headset.
03:16  She's in the corridor outside this room. I can see the light under the door. I can't hear anything at all.
03:17  RECORDING STOPS

(This entry is in a different hand:)
The original is filed in the Archive under the usual call number. Everything in this building stopped when it stopped.`,
  },
  {
    id: 'hana_note_lab',
    title: 'Note, Weighted Under the Microphone',
    style: 'hand',
    source: 'Restricted lab',
    body: `To whoever comes,

The lift key is on the chair. The lift still runs if you have got power back.

If you've come this far you've probably seen someone walking in these rooms. Please don't be frightened of her. She isn't what you think. I've watched the footage more times than anyone. Pull the original of 44 from the Archive and you'll see for yourself. It's filed like everything else.

Then read my notes.

H.`,
  },
  {
    id: 'hana_notebook',
    title: "Hana's Field Notebook",
    style: 'hand',
    source: 'Research Notes',
    body: `Sept 86. I worked out why I know that voice. I've got a cassette of her from our mother's birthday. I put them on the scope side by side. It's the same voice.

Nobody is going to believe this, so I'm not telling anyone.

She's calling from this building. It's a warning, and it's very close to the surface. It hasn't happened yet.

I wrote to her and told her not to come in winter. I can't say why, because if I tell her what she's going to say, she'll come. I know her. I know exactly what she does when someone tells her to stay away.

Oct 86. It's no good. The more I listen, the clearer the carrier gets. The Residual is cutting a deeper groove, and we're the ones doing it. Each listener makes it louder. Each session pushes it farther out. It's on the air now. Anyone with the right receiver could hear it.

There's only one person on that frequency.

I did this. She hears it because we listened.

If I bring all forty-one of us down at once and open the gain all the way, maybe it burns out. Maybe it goes quiet. Renn thinks it's a test. Let him.

If it doesn't work I'm sorry, Ilse. I really am.`,
  },
  {
    id: 'archive_guide',
    title: 'Archive Call Numbers: Staff Guide',
    style: 'memo',
    source: 'Poster, Level C corridor',
    body: `ARCHIVE RETRIEVAL: HOW TO QUOTE A CALL NUMBER

All originals are filed by a single call number, set on the panel beside the archive door:

   SERIES / TEST No. / TIME OF RECORDING

SERIES (one letter, from the originating programme):
   A   Acoustic
   B   Bioacoustic
   G   Geophonic
   S   Structural

TEST No.: two digits.

TIME OF RECORDING: four digits, 24-hour clock. Use the time the recording STOPPED, not the time it started.

Example: S / 07 / 1430

Please do not guess. The lever mechanism is older than you are.`,
  },
  {
    id: 'procedure_a',
    title: 'Annex Start-Up, Sheet 1',
    style: 'typed',
    source: 'Level C corridor',
    body: `ANNEX SYSTEMS: START-UP PROCEDURE
Sheet 1 of 3

DEEP GENERATOR

The generator is water-jacketed. It must NEVER be started dry.

Jacket coolant is supplied through a hand valve on the wall of the Level C corridor, red wheel, near the west end. If the valve is shut when the generator starts, it will overtemp and trip within seconds.

(The rest of this procedure is on sheets 2 and 3. Please keep the sheets together.)`,
  },
  {
    id: 'procedure_b',
    title: 'Annex Start-Up, Sheet 2',
    style: 'typed',
    source: 'Archive storage',
    body: `ANNEX SYSTEMS: START-UP PROCEDURE
Sheet 2 of 3

VENTILATION

The chamber fans are wired to the generator bus. They run up automatically whenever the generator starts. This is a safety requirement and cannot be changed. They can be switched off from the panel once the generator is running.

ACOUSTIC DAMPERS

The dampers are motor-driven and draw from the generator. They will not seat against moving air. If you command them with the fans running, you will fault the whole system and have to begin again.`,
  },
  {
    id: 'procedure_c',
    title: 'Annex Start-Up, Sheet 3',
    style: 'typed',
    source: 'Security control',
    body: `ANNEX SYSTEMS: START-UP PROCEDURE
Sheet 3 of 3

DOOR RELEASE

The chamber door is interlocked. It will not release unless the chamber is fully sealed, meaning all dampers seated. Attempting to release it unsealed faults the system.

Ignition: the generator key is held by the Director.`,
  },
  {
    id: 'director_final',
    title: "Dr. Renn's Last Note",
    style: 'hand',
    source: 'Security control',
    body: `14 Oct, late.

She has them all going down there and I can't stop it, and I'm the director of this place.

I've locked the generator. They are running on the Annex's own batteries for tonight, which will last until morning, and without the key nobody can start it again. I've put the ignition key in my office safe, where it belongs.

If you need it, the combination is the date this whole business ought to have ended: the date of Test 44, day first and then month. I chose it tonight, so I won't forget.

I'm going down to fetch them out.

L.R.`,
  },
  {
    id: 'cctv_playback',
    title: 'Reel G/44/0317: Security Playback',
    style: 'terminal',
    source: 'Security control, video deck',
    body: `PLAYBACK: G/44/0317
CAMERA 4, LAB CORRIDOR
15 OCT 1986, 03:16:40

A long corridor in emergency light. There is no sound on the reel.

A figure comes around the corner, walking slowly, holding a small light low. There is something on its back. A thin line rises from one shoulder.

It stops beneath the camera and looks up.

The picture is poor, but it is good enough.

Orange parka. Fur hood. A field radio with a whip antenna, Authority issue. You signed for that radio in March.

She looks exactly like you.

She looks up for a long moment. Then she carries on down the corridor, in the direction you came from an hour ago.

03:17:00. PICTURE LOST.`,
  },
  {
    id: 'hana_final',
    title: 'Tape: Hana, Final Recording',
    style: 'tape',
    source: 'The Annex, transmitter console',
    body: `[NO HISS AT ALL. THE ROOM ON THE TAPE IS PERFECTLY SILENT.]

HANA: Ilse. I don't know how far apart we are now. I'm going to assume you're standing right here.

I've worked it out, and it's too late to matter. The Visitor is you. You've been walking through this building for as long as the rock has been listening. All those nights Brandvold chased you down the corridors. All those rules they wrote to keep safe from you. You frightened forty people half to death, and you were only looking for me.

You were never in any danger here. You're the loudest thing in the mountain.

The transmitter in front of you is what's been sending it. It's only ever carried one thing, and you haven't said it yet.

There's a microphone there. I think you know the words. You've been listening to them for fourteen months.

If you say them, they go out, and they reach you, at Station Nine, in the autumn of last year. And you come.

If you cut the power, it stops. I think. I don't know what happens to you then. I don't know what it means for someone to arrive at a place for no reason.

Everyone is fine, by the way. I want you to know that. We've all just gone very quiet.

It's your choice. It's the only one anyone in this place ever really had.

I love you. Don't be angry.

[THE TAPE RUNS ON. THERE IS NOTHING ELSE ON IT.]`,
  },
  {
    id: 'terminal_reception',
    title: 'Reception Terminal',
    style: 'terminal',
    source: 'Reception desk',
    body: `HOLLIN RIDGE FACILITIES NET
AUX POWER. LIMITED FUNCTIONS.

BUILDING STATUS
  RECEPTION ......... AUX
  ADMINISTRATION .... AUX
  RESEARCH WING ..... EMERGENCY ONLY
  LEVEL C ........... NO SIGNAL

STAFF ON SITE: 41
STAFF SIGNED OUT: 0

LAST SYNC 15-10-86 03:17`,
  },
  {
    id: 'terminal_admin',
    title: "Director's Terminal",
    style: 'terminal',
    source: 'Administration office',
    body: `INTERNAL MAIL: DR L RENN
3 unread

FROM: R. SZABO, 14/10 17:02
Dr. Renn, the coach has been cancelled, so everyone is staying over tonight. I've put the Annex list on your desk. Everyone signed. Even the canteen staff.

FROM: T. BRANDVOLD, 14/10 21:30
Sir, I need ten minutes. It's about Camera 4.

FROM: H. MAREK, 14/10 23:12
Ludvik. Please come down. It'll go better if you're there.`,
  },
  {
    id: 'terminal_observation',
    title: 'Observation Console',
    style: 'terminal',
    source: 'Observation room',
    body: `CHAMBER B (RESTRICTED LAB) STATUS

SEAL ............. DISENGAGED
DOOR RELEASE ..... CONFIRMED

Test chamber door released at this console.

NOTE: Chamber B is a test room only. It is not the Annex. Level C access is by goods lift, through the far door of Chamber B. Maintenance key required.`,
  },
];

export const DOCUMENTS: Record<string, DocumentDef> = Object.fromEntries(docs.map((doc) => [doc.id, doc]));
