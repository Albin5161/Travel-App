// The privacy policy and terms, as shown at /privacy and /terms. Written to match what the app and
// its server actually do; when a data flow changes (a new service, a new thing stored, a different
// retention), change the words here in the same commit and move `updated`.
// Links are written [like this](https://…).

export type LegalBlock = string | { list: string[] };
export type LegalDoc = {
  title: string;
  updated: string;
  intro: string[];
  sections: { heading: string; blocks: LegalBlock[] }[];
};

const OPERATOR = 'Albin';
const EMAIL = '5161.albin@gmail.com';
const UPDATED = '26 September 2026';

const GOOGLE_PRIVACY = '[Google Privacy Policy](https://policies.google.com/privacy)';
const YOUTUBE_TERMS = '[YouTube Terms of Service](https://www.youtube.com/t/terms)';
const MAPS_TERMS = '[Google Maps/Google Earth Additional Terms of Service](https://maps.google.com/help/terms_maps/)';

export const CONTACT_EMAIL = EMAIL;

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  updated: UPDATED,
  intro: [
    `Xplore turns travel videos into places you can save and plan. It is run by ${OPERATOR}, an individual in India (“I” and “me” below). This page explains what the app collects, why, who else sees it, how long it is kept, and what you can ask for.`,
  ],
  sections: [
    {
      heading: 'The short version',
      blocks: [
        {
          list: [
            'No email, phone number or password. Each phone or browser gets an anonymous ID.',
            'Your location never leaves your phone.',
            'Links you paste and searches you type are sent to Google and, for Instagram links, to Apify, to find the places in them.',
            'Nothing is sold, and nothing is used for advertising.',
          ],
        },
      ],
    },
    {
      heading: 'What the app collects',
      blocks: [
        {
          list: [
            'An anonymous account. The first time you use the app it signs you in anonymously and creates a random ID. It is not linked to your name, email or phone.',
            'Links you paste, and what is read from them: a video’s public title, description, caption, location tag, tagged accounts, recent public comments and, sometimes, a machine transcript of what is said. This is about the video, not about you. Results are shared, so anyone who pastes the same link gets the same stored result.',
            'Searches you type when adding a place, and the rough area of the places you are looking at, so nearby results come first.',
            'Which place or city you open, when it came from a link: a place’s page asks Google for its rating, hours and reviews, and a city’s page asks for notes about that town. Neither is linked to you.',
            'Your answers on the review screen (right, wrong or added), stored with your anonymous ID, the video and the place, to measure and improve accuracy.',
            'Shared trips. If you share a trip or join one, the name you choose, the trip plan, your votes and any notes are stored so the others on that trip can see them.',
            'Technical data. Your network (IP) address is used with your anonymous ID to limit how many requests one person can make. The hosting service also keeps standard request logs.',
          ],
        },
      ],
    },
    {
      heading: 'What stays on your phone',
      blocks: [
        {
          list: [
            'Your location. If you allow it, it is used on your phone to estimate drive times and, if you switch arrival alerts on, to notice when you arrive in a district where you have saved spots. It is never sent to me or anyone else.',
            'Your photo. It is never uploaded or shared, even on a shared trip.',
            'Your name, until you share or join a trip.',
            'Places and plans you have not shared, and each link you have read, for up to 30 days, so pasting it again is instant.',
          ],
        },
      ],
    },
    {
      heading: 'Why it is used',
      blocks: [
        {
          list: [
            'To run the app: find the places in a video, show them on a map, plan your days and share trips.',
            'To keep it working and fair: limit requests, prevent abuse, and keep costs within free allowances.',
            'To make it more accurate, from your right and wrong answers.',
          ],
        },
        'You give your consent by using these features. You can withdraw it at any time by stopping using the app and asking me to delete your data.',
      ],
    },
    {
      heading: 'Who else sees it',
      blocks: [
        'Xplore relies on these services to work. Each one handles data under its own policy:',
        {
          list: [
            `Google, for finding places, place photos and search (Places API), the map on the web (Maps JavaScript API), reading public YouTube videos (YouTube Data API) and reading a video’s text to find places (Gemini API). See the ${GOOGLE_PRIVACY}. On Gemini’s free tier, Google may use what is sent to improve its products, and people may review it. Only a video’s public text is sent, never your account details.`,
            `YouTube. Xplore uses YouTube API Services. By using YouTube features you agree to the ${YOUTUBE_TERMS}, and the ${GOOGLE_PRIVACY} applies.`,
            'Apify, which reads public Instagram reels when you paste an Instagram link. It receives the reel’s link. See [Apify’s privacy policy](https://apify.com/privacy-policy).',
            'Wikipedia and Wikivoyage (the Wikimedia Foundation), for notes about a city. Only the town’s name is sent. See [Wikimedia’s privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy).',
            'Supabase, for the database and the anonymous sign-in. See [Supabase’s privacy policy](https://supabase.com/privacy).',
            'Expo (EAS Hosting, which runs on Cloudflare), which serves the web app and its server. See [Expo’s privacy policy](https://expo.dev/privacy).',
            'Photos and thumbnails load directly from Google, YouTube and Instagram, which see your network address as any website would.',
          ],
        },
        'These services may process data outside India, including in the United States. I do not sell your data or share it for advertising. I may disclose it if the law requires me to.',
      ],
    },
    {
      heading: 'How long it is kept',
      blocks: [
        {
          list: [
            'What was read from a video, and a city’s notes: 30 days.',
            'Google’s ratings and reviews: not kept at all; fetched each time a place’s page is opened.',
            'Place matches: Google’s place IDs are kept (they identify places, not people); coordinates for up to 30 days.',
            'Request counters with your network address: deleted within 3 days.',
            'Your anonymous account, your answers and shared trips: until you ask me to delete them.',
            'On your phone: until you clear the app’s data or uninstall it; read links for up to 30 days.',
          ],
        },
      ],
    },
    {
      heading: 'Your rights',
      blocks: [
        `You can ask to see, correct or delete your data, withdraw your consent, or raise a complaint, by writing to [${EMAIL}](mailto:${EMAIL}). I will reply within 30 days. Because accounts are anonymous, I may need details to find yours, such as a shared trip’s six-letter code and roughly when you used the app.`,
        'Deleting the app or clearing your browser’s data removes what is stored on your device. After that, your anonymous account cannot be recovered.',
      ],
    },
    {
      heading: 'Age',
      blocks: [
        'Xplore is for people aged 18 and over. I do not knowingly collect data from anyone younger. If you think someone under 18 has used it, write to me and I will delete their data.',
      ],
    },
    {
      heading: 'Security',
      blocks: [
        'Connections are encrypted, service keys are kept on the server and never in the app, and the database only lets people read their own trips. No system is perfectly secure, but I take reasonable care to protect your data.',
      ],
    },
    {
      heading: 'Changes',
      blocks: [
        'If this policy changes, the date above changes with it. For significant changes, the app will tell you.',
      ],
    },
    {
      heading: 'Contact and grievances',
      blocks: [`${OPERATOR}, [${EMAIL}](mailto:${EMAIL}).`],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of use',
  updated: UPDATED,
  intro: [
    `These terms are an agreement between you and ${OPERATOR}, an individual in India who runs Xplore. By using Xplore you agree to them and to the [privacy policy](/privacy). You must be 18 or over.`,
  ],
  sections: [
    {
      heading: 'An early version',
      blocks: [
        'Xplore is free and in testing. Features may change, break or be removed, saved data may be lost, and the service may end. Please keep your own copy of anything important.',
      ],
    },
    {
      heading: 'Places and plans are a starting point',
      blocks: [
        'Xplore finds places in videos automatically, and it can get them wrong: a place may be misidentified, closed, moved, seasonal or unsafe. Plans, times, costs, distances and safety notes are estimates. Check before you go. You are responsible for your own travel decisions and your safety.',
      ],
    },
    {
      heading: 'Using Xplore fairly',
      blocks: [
        'Use Xplore for your own, lawful, non-commercial travel planning. Please do not:',
        {
          list: [
            'scrape it, get around its limits, or overload or disrupt it;',
            'try to access other people’s data or the server’s keys;',
            'paste links to videos you are not allowed to view, or write trip names or notes that are unlawful, abusive or infringe anyone’s rights.',
          ],
        },
      ],
    },
    {
      heading: 'Other people’s content',
      blocks: [
        'Videos, captions, photos and place information belong to their owners: creators, Instagram, YouTube, Google and photographers. Xplore shows them with credit and links, and claims no ownership of them. If you own something shown in Xplore and want it removed, write to me.',
        `Xplore is not affiliated with, or endorsed by, Instagram, Meta, YouTube or Google.`,
      ],
    },
    {
      heading: 'Google and YouTube terms',
      blocks: [
        `Xplore’s maps and place information come from Google Maps Platform. By using them you agree to the ${MAPS_TERMS} and the ${GOOGLE_PRIVACY}.`,
        `Xplore uses YouTube API Services. By using its YouTube features you agree to the ${YOUTUBE_TERMS}.`,
      ],
    },
    {
      heading: 'What you add',
      blocks: [
        'Trip names, notes and votes you add stay yours. You let Xplore store them and show them to the people on your trip, as far as needed to run the service.',
      ],
    },
    {
      heading: 'No guarantees',
      blocks: [
        'Xplore is provided “as is” and “as available”, without warranties of any kind, to the extent the law allows.',
      ],
    },
    {
      heading: 'Limits on liability',
      blocks: [
        'To the extent the law allows, I am not liable for indirect or consequential losses, or for losses arising from travel you plan with Xplore, and my total liability to you is limited to ₹1,000. Nothing here limits liability that cannot be limited by law.',
      ],
    },
    {
      heading: 'Ending',
      blocks: [
        'You can stop using Xplore at any time and ask me to delete your data. I may suspend access if these terms are broken, or end the service.',
      ],
    },
    {
      heading: 'Changes',
      blocks: [
        'If these terms change, the date above changes with it, and the app will tell you about significant changes. Using Xplore after that means you accept the new terms.',
      ],
    },
    {
      heading: 'Law and contact',
      blocks: [
        `These terms are governed by the laws of India, and disputes go to the courts of India. Questions: [${EMAIL}](mailto:${EMAIL}).`,
      ],
    },
  ],
};
