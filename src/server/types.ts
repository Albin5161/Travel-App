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

/**
 * What an Instagram reel gave the model to read. Kept with each result, so we can learn which
 * sources actually name places: `select result->'signals' from api_extractions`.
 */
export type ReelSignals = {
  caption: boolean;
  locationTag: boolean;
  taggedAccounts: boolean;
  comments: boolean;
  /** The spoken words were fetched: a second, pricier try when the text alone named nothing. */
  transcript: boolean;
};

/**
 * Why an Instagram link falls back to adding places by search: the scraper isn't set up, today's
 * cap is used, the reel couldn't be read (private, deleted, or the scraper failed), or it was read
 * but named no places.
 */
export type AssistReason = 'not_configured' | 'daily_limit' | 'unreadable' | 'no_places';

export type ExtractResult =
  | {
      status: 'done';
      platform: 'youtube' | 'instagram';
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
      /** Instagram only. */
      signals?: ReelSignals;
      timings: Timings;
    }
  | {
      /** The reel couldn't be read for places; the app shows it and lets the user add them by search. */
      status: 'assist';
      platform: 'instagram';
      url: string;
      reason: AssistReason;
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
