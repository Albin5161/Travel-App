// Canned Plan-mode data. SAMPLE DATA for the demo: shaped like what Google Places (ratings, reviews)
// and our own estimates (cost, safety facts) would return, so a real service can replace it.

import type { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { SafetyIconName } from '@/components/SafetyIcon';

type FeatherName = ComponentProps<typeof Feather>['name'];

export interface CostLine {
  label: string;
  /** Rupees per person per day, mid-range. */
  amount: number;
}

export interface SafetyFact {
  /** One of our own safety icons where one fits, otherwise a Feather icon. */
  icon: SafetyIconName | FeatherName;
  title: string;
  detail: string;
}

export interface CityInfo {
  summary: string;
  bestTime: string;
  idealStay: string;
  /** Per person per day, mid-range, in rupees. */
  costPerDay: { low: number; high: number };
  costBreakdown: CostLine[];
  /** Specific facts: what the score below is made of, in words a traveller can act on. */
  safety: SafetyFact[];
  /**
   * A 0–100 comfort score with the dated signals behind it (after Atlys's "India currently").
   * Always shown with its basis, and as sample data until a real source backs it.
   */
  safetyScore: { score: number; signals: SafetySignal[] };
  localTips: string[];
}

export interface SafetySignal {
  /** e.g. "Mar" and "'26" */
  month: string;
  year: string;
  text: string;
  tag: string;
  direction: 'up' | 'down';
}

export const SAFETY_BANDS = ['Low', 'Moderate', 'High', 'Excellent'] as const;
/** Where each band starts on the 0–100 scale. */
export const SAFETY_BAND_STARTS = [0, 30, 55, 80];
export const safetyBand = (score: number) =>
  SAFETY_BANDS[SAFETY_BAND_STARTS.filter((start) => score >= start).length - 1];

export interface Review {
  author: string;
  when: string;
  text: string;
}

export interface PlaceRating {
  /** Out of 5, as Google shows it. */
  score: number;
  count: number;
  review: Review;
}

export const cityInfo: Record<string, CityInfo> = {
  gokarna: {
    summary:
      'A temple town on the Karnataka coast, with a string of beaches linked by cliff trails. Mornings are for the temple lanes, afternoons for walking beach to beach, and evenings for sunset at Om.',
    bestTime: 'Oct – Mar',
    idealStay: '2 days',
    costPerDay: { low: 1800, high: 3000 },
    costBreakdown: [
      { label: 'Stay', amount: 1200 },
      { label: 'Food', amount: 700 },
      { label: 'Getting around', amount: 400 },
      { label: 'Entry & extras', amount: 200 },
    ],
    safety: [
      {
        icon: 'strong-currents',
        title: 'Strong currents at Om and Kudle',
        detail: 'Swim only between the flags, and not after 5 pm.',
      },
      { icon: 'lifeguard', title: 'Lifeguards on Gokarna and Om beach', detail: 'On duty roughly 9 am to 6 pm.' },
      {
        icon: 'moon',
        title: 'The cliff trail is unlit',
        detail: 'Head back from Paradise Beach before sunset. It takes about 40 minutes.',
      },
      {
        icon: 'solo-friendly',
        title: 'Solo-friendly',
        detail: 'A busy backpacker scene. Hostels and cafés stay lively till late.',
      },
      {
        icon: 'crowded-weekends',
        title: 'Crowded on weekends',
        detail: 'Om Beach fills up with day-trippers from Goa. Go on a weekday.',
      },
      {
        icon: 'patchy-network',
        title: 'Patchy network past Half Moon',
        detail: 'Download offline maps before you start the trail.',
      },
    ],
    safetyScore: {
      score: 72,
      signals: [
        {
          month: 'Aug',
          year: "'26",
          direction: 'down',
          tag: 'beach safety',
          text: 'Rip currents closed Kudle and Om for swimming in peak monsoon. Both reopened in September.',
        },
        {
          month: 'Mar',
          year: "'26",
          direction: 'up',
          tag: 'lifeguards',
          text: 'Lifeguard hours on Om Beach extended to 6 pm for the season.',
        },
        {
          month: 'Dec',
          year: "'25",
          direction: 'up',
          tag: 'trails',
          text: 'New markers on the cliff trail from Kudle to Paradise make it easier to follow.',
        },
      ],
    },
    localTips: [
      'At the temple, cover your shoulders and knees.',
      'Boats from Om to Paradise run about ₹300 a person when the sea is calm.',
      'Most beach shacks take cash only.',
    ],
  },
  kochi: {
    summary:
      'Colonial streets, Chinese fishing nets and a spice-market quarter, all walkable in a day. Start early before the heat, and end at the waterfront for sunset.',
    bestTime: 'Oct – Feb',
    idealStay: '1–2 days',
    costPerDay: { low: 2000, high: 3500 },
    costBreakdown: [
      { label: 'Stay', amount: 1500 },
      { label: 'Food', amount: 800 },
      { label: 'Getting around', amount: 300 },
      { label: 'Entry & extras', amount: 150 },
    ],
    safety: [
      {
        icon: 'well-lit-at-night',
        title: 'Well lit and busy till 10 pm',
        detail: 'Fort Kochi is easy to walk after dark.',
      },
      {
        icon: 'thermometer',
        title: 'Heat and humidity',
        detail: 'Carry water, and plan something indoors from 12 to 3 pm.',
      },
      {
        icon: 'lifeguard',
        title: 'Ferries are safe and cheap',
        detail: 'About ₹6 across to Ernakulam. Wear the life vest.',
      },
      {
        icon: 'alert-circle',
        title: 'Tuk-tuk shopping tours',
        detail: 'Agree the fare first, and say no to shop stops.',
      },
      {
        icon: 'women-friendly',
        title: 'Women-friendly',
        detail: 'Solo women travellers report feeling safe in Fort Kochi.',
      },
    ],
    safetyScore: {
      score: 81,
      signals: [
        {
          month: 'Jul',
          year: "'26",
          direction: 'up',
          tag: 'night safety',
          text: 'Evening patrols added along the Fort Kochi waterfront and Princess Street.',
        },
        {
          month: 'Apr',
          year: "'26",
          direction: 'down',
          tag: 'heat',
          text: 'A heat advisory asked visitors to stay indoors from noon to 3 pm for two weeks.',
        },
        {
          month: 'Jan',
          year: "'26",
          direction: 'up',
          tag: 'transport',
          text: 'More water-metro boats between Fort Kochi and the mainland cut waiting times.',
        },
      ],
    },
    localTips: [
      'Jew Town shops close on Friday afternoon and Saturday.',
      'Catch the Kathakali make-up session an hour before the show.',
      'The fishing nets are best at sunrise, when they’re working.',
    ],
  },
  meghalaya: {
    summary:
      'Living-root bridges, cloud-filled valleys and some of India’s tallest waterfalls. Days start early and end early, and the weather decides everything.',
    bestTime: 'Oct – Apr',
    idealStay: '3 days',
    costPerDay: { low: 2200, high: 3800 },
    costBreakdown: [
      { label: 'Stay', amount: 1400 },
      { label: 'Getting around', amount: 1200 },
      { label: 'Food', amount: 600 },
      { label: 'Entry & extras', amount: 200 },
    ],
    safety: [
      {
        icon: 'slippery-path',
        title: 'Slippery steps to Nongriat',
        detail: 'About 3,500 steps. Wear shoes with grip, and skip it in heavy rain.',
      },
      { icon: 'cloud', title: 'Fog closes viewpoints fast', detail: 'Go early. Afternoons often white out.' },
      { icon: 'moon', title: 'Narrow, dark roads', detail: 'Avoid driving after 6 pm.' },
      { icon: 'patchy-network', title: 'Patchy network', detail: 'Only some networks work in parts of Sohra.' },
      { icon: 'solo-friendly', title: 'Solo-friendly', detail: 'Homestays are welcoming. Book ahead in season.' },
    ],
    safetyScore: {
      score: 66,
      signals: [
        {
          month: 'Jul',
          year: "'26",
          direction: 'down',
          tag: 'roads',
          text: 'Landslides closed the Sohra road for three days during heavy rain.',
        },
        {
          month: 'Feb',
          year: "'26",
          direction: 'up',
          tag: 'trails',
          text: 'New railings on the steepest steps down to Nongriat.',
        },
        {
          month: 'Nov',
          year: "'25",
          direction: 'up',
          tag: 'support',
          text: 'Homestays in Sohra began sharing a common helpline for guests.',
        },
      ],
    },
    localTips: [
      'Carry cash. There are few ATMs past Shillong.',
      'Boating at Dawki is clearest from November to February.',
      'Taxis charge by the day, so share one with other travellers.',
    ],
  },
};

export const placeRatings: Record<string, PlaceRating> = {
  'gok-temple': {
    score: 4.6,
    count: 12400,
    review: {
      author: 'Ravi K.',
      when: '2 weeks ago',
      text: 'Ancient and calm early in the morning. The queue moves fast before 8.',
    },
  },
  'gok-mainbeach': {
    score: 4.3,
    count: 8100,
    review: {
      author: 'Meera S.',
      when: 'a month ago',
      text: 'Long, wide beach right by the town. Great for a sunrise walk.',
    },
  },
  'gok-kudle': {
    score: 4.6,
    count: 6200,
    review: { author: 'Arjun P.', when: '3 weeks ago', text: 'Chilled vibe, good shacks, and a lovely sunset.' },
  },
  'gok-cafe': {
    score: 4.5,
    count: 1900,
    review: { author: 'Nisha R.', when: '2 months ago', text: 'Smoothie bowls with a view of Kudle. Worth the climb.' },
  },
  'gok-paradise': {
    score: 4.5,
    count: 3300,
    review: {
      author: 'Karthik M.',
      when: 'a month ago',
      text: 'Hard to reach but so worth it. Almost empty on weekdays.',
    },
  },
  'gok-halfmoon': {
    score: 4.4,
    count: 2700,
    review: { author: 'Sana A.', when: '3 months ago', text: 'Quiet little cove on the trail. Carry water.' },
  },
  'gok-om': {
    score: 4.6,
    count: 21000,
    review: { author: 'Vivek J.', when: 'a week ago', text: 'The Om-shaped bay at sunset is unreal.' },
  },
  'gok-prema': {
    score: 4.4,
    count: 3100,
    review: { author: 'Pooja H.', when: '2 weeks ago', text: 'Old-school thali, and the best gadbad ice cream.' },
  },
  'kochi-mural': {
    score: 4.6,
    count: 2200,
    review: { author: 'Anand T.', when: 'a month ago', text: 'Every lane has something new. Go before 10 am.' },
  },
  'kochi-street': {
    score: 4.4,
    count: 9800,
    review: { author: 'Farah Z.', when: '3 weeks ago', text: 'Antique shops, and the smell of spices everywhere.' },
  },
  'kochi-pier': {
    score: 4.3,
    count: 4500,
    review: {
      author: 'Joseph M.',
      when: '2 months ago',
      text: 'The ferry across at sunset is the best ₹6 you’ll spend.',
    },
  },
  'kochi-waterfront': {
    score: 4.5,
    count: 18000,
    review: { author: 'Divya N.', when: 'a week ago', text: 'Fishing nets, a sea breeze and fresh fish frying.' },
  },
  'meg-valley': {
    score: 4.7,
    count: 3900,
    review: { author: 'Rohan D.', when: 'a month ago', text: 'Clouds rolling through the valley. Go early.' },
  },
  'meg-falls': {
    score: 4.6,
    count: 15000,
    review: {
      author: 'Ibakordor L.',
      when: '2 weeks ago',
      text: 'The tallest plunge falls in India. Clearest in the morning.',
    },
  },
  'meg-bridge': {
    score: 4.8,
    count: 7600,
    review: { author: 'Aditi G.', when: '3 weeks ago', text: 'Tough steps, but the double-decker bridge is magical.' },
  },
  'meg-dawki': {
    score: 4.4,
    count: 11000,
    review: {
      author: 'Samir B.',
      when: 'a month ago',
      text: 'Crystal-clear water in winter. The boats are a bit pricey.',
    },
  },
};

export const getCityInfo = (cityId: string): CityInfo | undefined => cityInfo[cityId];
export const getPlaceRating = (placeId: string): PlaceRating | undefined => placeRatings[placeId];

export const formatRupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
