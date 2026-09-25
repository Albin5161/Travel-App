// The API's wire format. The app will import these types when it switches from the mock.

export type PlaceKind = 'food' | 'stay' | 'sight' | 'experience';

/** A place as the model found it in the video's text, before it's matched to a real one. */
export type FoundPlace = {
  name: string;
  type: PlaceKind;
  area: string | null;
  why: string;
  timestamp: string | null;
  confidence: number;
};

export type Timings = Record<string, number>;

export type ExtractResult =
  | {
      status: 'done';
      platform: 'youtube';
      cached: boolean;
      video: {
        id: string;
        title: string;
        channel: string;
        durationSeconds: number | null;
        thumbnail: string | null;
      };
      region: string | null;
      places: FoundPlace[];
      usage: { model: string; inputTokens: number; outputTokens: number };
      timings: Timings;
    }
  | {
      /** Instagram can't be read; the app shows the reel and lets the user add places by search. */
      status: 'assist';
      platform: 'instagram';
      url: string;
      timings: Timings;
    };

export type MatchRequest = { name: string; area?: string | null; region?: string | null; confidence?: number };

export type PlacePhoto = {
  uri: string;
  /** Google requires crediting the photo's author, and linking to the photo on Google Maps. */
  attributions: { name: string; uri: string }[];
  googleMapsUri: string | null;
};

export type MatchedPlace = {
  placeId: string;
  location: { lat: number; lng: number };
  /** Only on a fresh lookup: Google's terms don't allow storing addresses or categories. */
  address: string | null;
  types: string[];
  photo: PlacePhoto | null;
};

export type FeedbackRequest = {
  videoId?: string | null;
  placeName: string;
  placeId?: string | null;
  verdict: 'right' | 'wrong' | 'added';
};

export type MatchResult =
  | { status: 'matched'; place: MatchedPlace; needsCheck: boolean; cached: boolean; timings: Timings }
  | { status: 'unmatched'; needsCheck: true; cached: boolean; timings: Timings };
