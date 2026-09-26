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
      /** The reel's title and thumbnail, when it could be read at all. */
      video?: Extract<ExtractResult, { status: 'done' }>['video'];
      timings: Timings;
    };

export type MatchRequest = {
  name: string;
  area?: string | null;
  region?: string | null;
  confidence?: number;
  /** A place picked from search: skip finding it by name. */
  placeId?: string | null;
  /** The search session the pick ends (see places.searchPlaces). */
  sessionToken?: string | null;
};

/** What someone is typing in "Missed one?", and where the reel is, to lean results toward it. */
export type SearchRequest = { input: string; sessionToken: string; near?: { lat: number; lng: number } | null };

export type SearchResult = { suggestions: { placeId: string; name: string; where: string }[] };

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

/**
 * What Google says about one place, for its page: fetched when someone opens it and never stored,
 * as Google's terms require. `limited` when today's cap is used; the page just leaves it out.
 */
export type PlaceInfo =
  | {
      status: 'ok';
      rating: number | null;
      ratingCount: number | null;
      /** 0 free to 4 very expensive, as Google rates it. */
      priceLevel: number | null;
      openNow: boolean | null;
      hours: string[];
      summary: string | null;
      reviews: {
        author: string;
        authorUri: string | null;
        rating: number | null;
        text: string;
        when: string;
      }[];
      googleMapsUri: string | null;
    }
  | { status: 'limited' };

/**
 * A city's notes for travellers, summarised from Wikipedia and Wikivoyage (CC BY-SA 4.0) and kept
 * 30 days. Only what the sources say: anything they don't cover is null or empty.
 */
export type CityNotes = {
  summary: string | null;
  bestTime: string | null;
  idealStay: string | null;
  tips: string[];
  safety: string[];
  sources: { site: 'Wikipedia' | 'Wikivoyage'; title: string; url: string }[];
};

export type CityNotesRequest = { name: string; state?: string | null; near?: { lat: number; lng: number } | null };
