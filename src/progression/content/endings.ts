import type { EndingId } from '../../core/Script';
import type { Card } from '../../ui/Cards';

export const INTRO_CARDS: Card[] = [
  {
    small: 'Alpine Relay Authority, Station Nine',
    text: 'For fourteen months, a radio signal has come down off Hollin Ridge, every night, at 03:17. Nobody else can hear it.',
    hold: 5,
  },
  {
    text: 'Forty-one people work at the Institute up there. One of them is my sister. None of them answer the telephone.',
    hold: 4.6,
  },
  {
    small: '9 December 1987, 02:51',
    text: 'The road ran out four kilometres back. I walked the rest.',
    hold: 3.8,
  },
];

export const ANSWER_LINES = [
  'This is Ilse Marek, at Hollin Ridge.',
  "If you can hear this, don't come.",
  "Hana's gone. They've all gone. There's nothing you can do here.",
  'Please. Whoever you are. Do not come.',
];

export interface EndingText {
  title: string;
  label: string;
  lines: string[];
}

export const ENDINGS: Record<EndingId, EndingText> = {
  silence: {
    title: 'Ending: Silence',
    label: 'Silence',
    lines: [
      'The transmitter stopped at 03:17 on 9 December 1987. It has not been heard since.',
      'In the spring, an Authority inspector goes through the logbooks at Station Nine. There are fourteen months of entries, all in a careful hand, all describing a signal.',
      'He checks the tapes. They hold nothing at all.',
      'He marks the operator as absent without leave, and closes the file.',
    ],
  },
  answer: {
    title: 'Ending: Answer',
    label: 'Answer',
    lines: [
      'It takes four minutes to say. It always did.',
      'On a relay tower forty kilometres south, on the fifteenth of October of the year before, a needle moves.',
      'A young woman looks up from her logbook and frowns. She reaches for her headset.',
      'Behind her voice on the line, if she could only clean it up, there is the sound of someone walking through a long, empty building with a small light, in no hurry at all.',
    ],
  },
};
