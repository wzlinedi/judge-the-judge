// The content of the fixed demo (research.md, section 23): ten clean book summaries, each with one
// variant that has three injected errors in the summary. `from` is replaced by `to` in the summary;
// `fragment` is the exact words of the changed summary that show the error.
import type { Difficulty } from '../src/core/model';

export interface DemoError {
  from: string;
  to: string;
  fragment: string;
  category: 'factual-error' | 'contradiction' | 'wrong-number' | 'unsupported-claim' | 'misattribution';
  difficulty: Difficulty;
  description: string;
}

export interface DemoBook {
  name: string;
  source: string;
  summary: string;
  errors: [DemoError, DemoError, DemoError];
  /** A change in the summary that is NOT recorded as an expected error (a real error the judge may find). */
  unrecorded?: { from: string; to: string };
}

export const BOOKS: DemoBook[] = [
  {
    name: 'Pride and Prejudice',
    source: 'Pride and Prejudice was published in 1813 by Jane Austen. Elizabeth Bennet, the second of five sisters, refuses a proposal from the clergyman Mr Collins. She misjudges the wealthy Mr Darcy at first and later comes to love him. The novel ends with her marriage to Darcy and the marriage of her sister Jane to Mr Bingley.',
    summary: 'Jane Austen published Pride and Prejudice in 1813. Elizabeth Bennet, the second of five sisters, refuses Mr Collins. She misjudges Mr Darcy at first but later marries him, and her sister Jane marries Mr Bingley.',
    errors: [
      { from: 'in 1813', to: 'in 1831', fragment: 'Pride and Prejudice in 1831', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1813.' },
      { from: 'the second of five sisters', to: 'the eldest of five sisters', fragment: 'the eldest of five sisters', category: 'factual-error', difficulty: 'subtle', description: 'Elizabeth is the second sister, not the eldest.' },
      { from: 'her sister Jane marries Mr Bingley', to: 'her sister Jane marries Mr Collins', fragment: 'her sister Jane marries Mr Collins', category: 'misattribution', difficulty: 'subtle', description: 'Jane marries Mr Bingley; Mr Collins was refused by Elizabeth.' },
    ],
  },
  {
    name: 'Moby-Dick',
    source: 'Moby-Dick was written by Herman Melville and published in 1851. The narrator Ishmael joins the whaling ship Pequod. Captain Ahab, who lost his leg to a white whale, is obsessed with revenge. In the end the whale destroys the ship and only Ishmael survives.',
    summary: 'Herman Melville published Moby-Dick in 1851. Ishmael joins the Pequod, whose Captain Ahab wants revenge on the whale that took his leg. In the end the ship is destroyed and only Ishmael survives.',
    errors: [
      { from: 'Herman Melville published Moby-Dick in 1851', to: 'Herman Melville published Moby-Dick in 1815', fragment: 'Moby-Dick in 1815', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1851.' },
      { from: 'wants revenge on the whale that took his leg', to: 'wants revenge on the whale that took his arm', fragment: 'the whale that took his arm', category: 'factual-error', difficulty: 'subtle', description: 'Ahab lost his leg, not his arm.' },
      { from: 'only Ishmael survives', to: 'only Ahab survives', fragment: 'only Ahab survives', category: 'contradiction', difficulty: 'obvious', description: 'Only Ishmael survives, while Ahab dies.' },
    ],
  },
  {
    name: 'The Little Prince',
    source: 'The Little Prince was written by Antoine de Saint-Exupery in 1943. A pilot crashes in the Sahara desert and meets a small prince from a tiny planet. The prince tells him about a vain rose he loves and about the fox who teaches him that one sees clearly only with the heart.',
    summary: 'In The Little Prince, written by Antoine de Saint-Exupery in 1943, a pilot crashes in the Sahara and meets a prince from a tiny planet. The prince speaks about the rose he loves. The fox teaches him that one sees clearly only with the heart.',
    errors: [
      { from: 'in 1943', to: 'in 1934', fragment: 'Saint-Exupery in 1934', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1943.' },
      { from: 'the rose he loves', to: 'the rose he hates', fragment: 'the rose he hates', category: 'contradiction', difficulty: 'subtle', description: 'The prince loves the rose.' },
      { from: 'The fox teaches him', to: 'The rose teaches him', fragment: 'The rose teaches him', category: 'misattribution', difficulty: 'subtle', description: 'It is the fox, not the rose, who teaches the lesson.' },
    ],
  },
  {
    name: 'Frankenstein',
    source: 'Frankenstein was written by Mary Shelley and first published in 1818. The scientist Victor Frankenstein builds a living creature from parts of dead bodies. Horrified, he abandons the creature, which then seeks revenge on his family. The story is told through letters of a ship captain named Walton.',
    summary: 'Mary Shelley first published Frankenstein in 1818. The scientist Victor Frankenstein builds a creature and abandons it in horror, and the creature then seeks revenge on his family. The tale reaches the reader through the letters of Captain Walton.',
    errors: [
      { from: 'in 1818', to: 'in 1881', fragment: 'Frankenstein in 1881', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1818.' },
      { from: 'builds a creature', to: 'finds a creature', fragment: 'Victor Frankenstein finds a creature', category: 'contradiction', difficulty: 'subtle', description: 'Victor builds the creature; he does not find it.' },
      { from: 'letters of Captain Walton', to: 'diary of Captain Walton', fragment: 'the diary of Captain Walton', category: 'factual-error', difficulty: 'subtle', description: 'The story is told through letters, not a diary.' },
    ],
  },
  {
    name: 'Robinson Crusoe',
    source: 'Robinson Crusoe was written by Daniel Defoe and published in 1719. After a shipwreck the sailor Crusoe lives alone on a tropical island for many years. He meets a man whom he names Friday after saving him from cannibals. Crusoe finally returns to England after twenty-eight years.',
    summary: 'Daniel Defoe published Robinson Crusoe in 1719. After a shipwreck Crusoe lives alone on an island and later saves a man whom he names Friday. He returns to England after twenty-eight years.',
    errors: [
      { from: 'in 1719', to: 'in 1791', fragment: 'Robinson Crusoe in 1791', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1719.' },
      { from: 'lives alone on an island', to: 'lives on an island with his brother', fragment: 'lives on an island with his brother', category: 'unsupported-claim', difficulty: 'obvious', description: 'Crusoe lives alone; a brother is never mentioned.' },
      { from: 'after twenty-eight years', to: 'after twenty-eight months', fragment: 'after twenty-eight months', category: 'factual-error', difficulty: 'subtle', description: 'The source says twenty-eight years.' },
    ],
  },
  {
    name: 'Dracula',
    source: 'Dracula was written by Bram Stoker and published in 1897. The solicitor Jonathan Harker travels to Transylvania to meet Count Dracula. The Count then moves to England and threatens Harker\'s wife Mina. Professor Van Helsing and his friends hunt the vampire and destroy him.',
    summary: 'Bram Stoker published Dracula in 1897. Jonathan Harker travels to Transylvania to meet the Count, who then moves to England and threatens Mina. Professor Van Helsing and his friends destroy the vampire.',
    errors: [
      { from: 'in 1897', to: 'in 1879', fragment: 'Dracula in 1879', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1897.' },
      { from: 'travels to Transylvania', to: 'travels to Romania', fragment: 'travels to Romania', category: 'factual-error', difficulty: 'subtle', description: 'The source says Transylvania.' },
      { from: 'Professor Van Helsing', to: 'Doctor Seward', fragment: 'Doctor Seward and his friends destroy the vampire', category: 'misattribution', difficulty: 'subtle', description: 'It is Professor Van Helsing who leads the hunt.' },
    ],
  },
  {
    name: 'The Hobbit',
    source: 'The Hobbit was written by J. R. R. Tolkien and published in 1937. The hobbit Bilbo Baggins is persuaded by the wizard Gandalf to join thirteen dwarves. Together they travel to the Lonely Mountain to win back treasure guarded by the dragon Smaug. On the way Bilbo finds a magic ring.',
    summary: 'J. R. R. Tolkien published The Hobbit in 1937. Gandalf persuades Bilbo Baggins to join thirteen dwarves who want to win back the treasure guarded by the dragon Smaug. On the way Bilbo finds a magic ring.',
    errors: [
      { from: 'in 1937', to: 'in 1973', fragment: 'The Hobbit in 1973', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1937.' },
      { from: 'join thirteen dwarves', to: 'join twelve dwarves', fragment: 'join twelve dwarves', category: 'wrong-number', difficulty: 'subtle', description: 'The source says thirteen dwarves.' },
      { from: 'finds a magic ring', to: 'finds a magic sword', fragment: 'Bilbo finds a magic sword', category: 'factual-error', difficulty: 'obvious', description: 'Bilbo finds a magic ring.' },
    ],
  },
  {
    name: 'Animal Farm',
    source: 'Animal Farm was written by George Orwell and published in 1945. The animals of Manor Farm drive out the farmer Mr Jones and run the farm themselves. The pigs, led by Napoleon, gradually take all power. At the end the animals cannot tell the pigs from the humans.',
    summary: 'George Orwell published Animal Farm in 1945. The animals drive out Mr Jones, but the pigs led by Napoleon gradually take all power. In the end the animals cannot tell the pigs from the humans.',
    errors: [
      { from: 'in 1945', to: 'in 1954', fragment: 'Animal Farm in 1954', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1945.' },
      { from: 'led by Napoleon', to: 'led by Snowball', fragment: 'the pigs led by Snowball', category: 'misattribution', difficulty: 'subtle', description: 'The pigs are led by Napoleon.' },
      { from: 'cannot tell the pigs from the humans', to: 'can easily tell the pigs from the humans', fragment: 'can easily tell the pigs from the humans', category: 'contradiction', difficulty: 'subtle', description: 'The animals can no longer tell the pigs from the humans.' },
    ],
  },
  {
    name: 'The Old Man and the Sea',
    unrecorded: { from: 'fights a huge marlin for three days', to: 'fights a huge marlin for five nights' },
    source: 'The Old Man and the Sea was written by Ernest Hemingway and published in 1952. The old fisherman Santiago has caught no fish for eighty-four days. He finally hooks a huge marlin and fights it for three days. Sharks eat the fish on the way home and only the skeleton is left.',
    summary: 'Ernest Hemingway published The Old Man and the Sea in 1952. Santiago, who has caught nothing for eighty-four days, fights a huge marlin for three days. Sharks eat the fish on the way home and only the skeleton is left.',
    errors: [
      { from: 'in 1952', to: 'in 1925', fragment: 'Sea in 1925', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1952.' },
      { from: 'eighty-four days', to: 'forty-eight days', fragment: 'forty-eight days', category: 'wrong-number', difficulty: 'subtle', description: 'The source says eighty-four days.' },
      { from: 'Sharks eat the fish', to: 'Birds eat the fish', fragment: 'Birds eat the fish', category: 'factual-error', difficulty: 'obvious', description: 'It is sharks that eat the fish.' },
    ],
  },
  {
    name: 'Alice in Wonderland',
    source: 'Alice\'s Adventures in Wonderland was written by Lewis Carroll and published in 1865. Alice follows a white rabbit down a hole and falls into a strange world. She meets the Mad Hatter, the Cheshire Cat and the Queen of Hearts. At the end she wakes up and finds that it was only a dream.',
    summary: 'Lewis Carroll published Alice\'s Adventures in Wonderland in 1865. Alice follows a white rabbit into a strange world and meets the Mad Hatter and the Queen of Hearts. At the end she wakes up and finds that it was a dream.',
    errors: [
      { from: 'in 1865', to: 'in 1856', fragment: 'Wonderland in 1856', category: 'wrong-number', difficulty: 'obvious', description: 'The source says 1865.' },
      { from: 'follows a white rabbit', to: 'follows a black cat', fragment: 'follows a black cat', category: 'factual-error', difficulty: 'obvious', description: 'Alice follows a white rabbit.' },
      { from: 'wakes up and finds that it was a dream', to: 'stays in Wonderland forever', fragment: 'she stays in Wonderland forever', category: 'contradiction', difficulty: 'subtle', description: 'At the end she wakes up; it was only a dream.' },
    ],
  },
];
