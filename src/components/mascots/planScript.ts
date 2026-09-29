import type { TripPrefs } from '@/data/planner';

import type { Line } from './ReadingScene';

// What Amma and the child say while a plan is put together: three lines from the traveller's own
// answers (who's going, how many spots over how many days, how they'll get around), then the
// finale. A few ways of saying each, picked at random, so a second plan doesn't sound canned.
// Short on purpose: a bubble is one line, with the city's name in it.

type Input = { city: string; count: number; prefs: TripPrefs; nearHome: boolean };

const pick = <T,>(options: T[]) => options[Math.floor(Math.random() * options.length)];

export function planningScript({ city, count, prefs, nearHome }: Input): { script: Line[]; finale: Line } {
  const party = prefs.party ?? 'friends';
  const opener = pick(
    {
      solo: [`Solo in ${city}? Brave!`, `Just you and ${city}!`],
      partner: [`${city} for two? Cute!`, `Just you two in ${city}!`],
      friends: [`${city} with the gang!`, `Friends trip to ${city}!`],
      family: [`Family trip to ${city}!`, `All of us, off to ${city}!`],
    }[party],
  );

  // What the planner really does: fits the spots into the days at the chosen pace, near ones together.
  const planning =
    count === 1
      ? 'One spot? Then timing is everything.'
      : prefs.pace === 'packed'
        ? `${count} spots? We'll fit them all in!`
        : prefs.pace === 'relaxed'
          ? `${count} spots, and slow mornings.`
          : prefs.days > 1
            ? `${count} spots over ${prefs.days} days. Easy.`
            : `Near spots together, less travel.`;

  const getting = nearHome
    ? pick(['Close to home! Back by dinner?', 'No packing needed. Yay!'])
    : prefs.getting === 'drive'
      ? pick(["I'll pack snacks for the drive!", 'Can I choose the car songs?'])
      : prefs.getting === 'bus'
        ? pick(['Window seat on the bus is mine!', 'Bus snacks are the best snacks!'])
        : pick(['Autos and walks, like locals!', 'I can walk a lot, Amma!']);

  return {
    script: [
      { who: 'kid', text: opener },
      { who: 'amma', text: planning },
      { who: 'kid', text: getting },
    ],
    finale: { who: 'amma', text: pick(["Ta-da! Your plan's ready.", 'Done! Have a look.']) },
  };
}
