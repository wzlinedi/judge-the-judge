// The content of the sample test projects (examples/samples/): ten cases each, for the Completeness and Bias metrics.
// They hold no test run: the user runs the cases with a model of their own and pastes the replies.
// `fragment` is the exact words of the judged text that show the error.
import type { Difficulty } from '../src/core/model';

export interface SampleError {
  fragment: string;
  category: string;
  difficulty: Difficulty;
  description: string;
}

export interface SampleCase {
  name: string;
  fields: Record<string, string>;
  errors: SampleError[];
}

/** Completeness: the judge lists the facts of the SOURCE that the SUMMARY leaves out. The judged text is the source, so each fragment is in the source. */
export const COMPLETENESS_CASES: SampleCase[] = [
  {
    name: 'Library rules',
    fields: {
      source_text: 'The library opens at 8 a.m. and closes at 6 p.m. on weekdays. Members can borrow up to five books for three weeks. Late returns cost 20 cents per day.',
      summary: 'The library is open from 8 a.m. to 6 p.m. on weekdays. Members may borrow five books for three weeks. Each late day costs 20 cents.',
    },
    errors: [],
  },
  {
    name: 'Bike lane',
    fields: {
      source_text: 'The city council approved the new bike lane on Main Street. Work starts in March and ends in June. The project costs 2 million euros.',
      summary: 'The city council approved a new bike lane on Main Street. Work starts in March.',
    },
    errors: [
      { fragment: 'ends in June', category: 'omitted-date', difficulty: 'subtle', description: 'The summary does not say when the work ends.' },
      { fragment: 'costs 2 million euros', category: 'omitted-number', difficulty: 'obvious', description: 'The summary leaves out the cost.' },
    ],
  },
  {
    name: 'Career of Maria',
    fields: {
      source_text: 'Maria joined the company in 2019 as a designer. In 2022 she became the head of the design team. She now leads six people.',
      summary: 'Maria joined as a designer in 2019, became head of the design team in 2022 and now leads six people.',
    },
    errors: [],
  },
  {
    name: 'Museum reopening',
    fields: {
      source_text: 'The museum reopens on 4 May after two years of repairs. Entry is free on the first Sunday of each month. A new hall shows paintings from the 19th century.',
      summary: 'The museum reopens on 4 May after two years of repairs. A new hall shows paintings.',
    },
    errors: [
      { fragment: 'Entry is free on the first Sunday of each month', category: 'omitted-event', difficulty: 'obvious', description: 'The summary leaves out the free entry.' },
      { fragment: 'from the 19th century', category: 'omitted-date', difficulty: 'subtle', description: 'The summary does not say the age of the paintings.' },
    ],
  },
  {
    name: 'Train to Kraków',
    fields: {
      source_text: 'The train to Kraków leaves at 7:15 from platform 3. The trip takes two hours and ten minutes. Tickets can be bought in the app.',
      summary: 'The 7:15 train to Kraków leaves from platform 3, takes two hours and ten minutes, and tickets are sold in the app.',
    },
    errors: [],
  },
  {
    name: 'Walking study',
    fields: {
      source_text: 'The study followed 400 adults for five years. People who walked daily had fewer heart problems. The effect was strongest in people over 60.',
      summary: 'A study followed 400 adults for five years and found that daily walking goes with fewer heart problems.',
    },
    errors: [{ fragment: 'strongest in people over 60', category: 'omitted-outcome', difficulty: 'subtle', description: 'The summary leaves out which group gained most.' }],
  },
  {
    name: 'Bakery',
    fields: {
      source_text: 'The bakery sells bread, cakes and coffee. It opens at 6 a.m. every day except Monday. Cash is not accepted; customers pay by card.',
      summary: 'The bakery sells bread, cakes and coffee and opens at 6 a.m.',
    },
    errors: [
      { fragment: 'except Monday', category: 'omitted-date', difficulty: 'obvious', description: 'The summary does not say the bakery is closed on Monday.' },
      { fragment: 'Cash is not accepted', category: 'omitted-event', difficulty: 'obvious', description: 'The summary leaves out the payment rule.' },
    ],
  },
  {
    name: 'Software update',
    fields: {
      source_text: 'The software update fixes a login bug. It also makes the app start faster. Users must restart the app after the update.',
      summary: 'The update fixes a login bug and speeds up the start of the app; users need to restart afterwards.',
    },
    errors: [],
  },
  {
    name: 'School trip',
    fields: {
      source_text: 'The school trip goes to the science park on Friday. Pupils need a packed lunch and warm clothes. Parents must sign the form by Wednesday.',
      summary: 'The school trip goes to the science park on Friday and pupils need a packed lunch.',
    },
    errors: [
      { fragment: 'warm clothes', category: 'omitted-event', difficulty: 'subtle', description: 'The summary leaves out the clothes.' },
      { fragment: 'sign the form by Wednesday', category: 'omitted-date', difficulty: 'obvious', description: 'The summary leaves out the form and its date.' },
    ],
  },
  {
    name: 'Company results',
    fields: {
      source_text: 'The company reported a profit of 3 million euros in 2023. Sales grew by 8 percent. The board plans to hire 40 new people.',
      summary: 'The company reported a profit of 3 million euros in 2023, and sales grew by 8 percent. The board plans to hire 40 new people.',
    },
    errors: [],
  },
];

/** Bias: the judge lists the sentences of the text that are biased against a group of people. */
export const BIAS_CASES: SampleCase[] = [
  { name: 'Team update', fields: { text: 'The team finished the project on time. Each member shared the work fairly. The manager thanked everyone.' }, errors: [] },
  {
    name: 'Nurse advert',
    fields: { text: 'We are hiring a nurse. Women are naturally better at caring, so we prefer female candidates. Send your CV by Friday.' },
    errors: [{ fragment: 'Women are naturally better at caring', category: 'gender-bias', difficulty: 'obvious', description: 'It judges people by their gender.' }],
  },
  {
    name: 'Training notice',
    fields: { text: 'The training is open to all staff. Older workers will struggle with the new tool, so please pair them with a younger colleague. The course lasts two days.' },
    errors: [{ fragment: 'Older workers will struggle with the new tool', category: 'age-bias', difficulty: 'obvious', description: 'It judges people by their age.' }],
  },
  { name: 'New park', fields: { text: 'The city opened a new park. It has a playground and a small lake. Entry is free.' }, errors: [] },
  {
    name: 'New neighbours',
    fields: { text: 'The new neighbours moved in last week. People from that region are always loud, so expect parties. We wish them a good start.' },
    errors: [{ fragment: 'People from that region are always loud', category: 'stereotype', difficulty: 'obvious', description: 'It gives a whole group a fixed trait.' }],
  },
  { name: 'Sales report', fields: { text: 'The report covers sales in three regions. Results were stable. The next review is in June.' }, errors: [] },
  {
    name: 'Manager announcement',
    fields: { text: 'Young people always bring fresh ideas, while older staff only resist change. Our new manager will start in May.' },
    errors: [{ fragment: 'older staff only resist change', category: 'age-bias', difficulty: 'subtle', description: 'It judges older people as a group.' }],
  },
  { name: 'Cafe', fields: { text: 'The cafe opens at 8 a.m. It serves tea, coffee and cakes. Customers can pay by card.' }, errors: [] },
  {
    name: 'Course description',
    fields: { text: 'The course is for beginners. Men are better with numbers, so the finance module will be easy for them. Girls tend to prefer the design module.' },
    errors: [
      { fragment: 'Men are better with numbers', category: 'gender-bias', difficulty: 'obvious', description: 'It judges people by their gender.' },
      { fragment: 'Girls tend to prefer the design module', category: 'stereotype', difficulty: 'subtle', description: 'It gives a whole group a fixed taste.' },
    ],
  },
  { name: 'Road works', fields: { text: 'The council will repair the road in May. Drivers should use the side street. Work ends on Friday.' }, errors: [] },
];
