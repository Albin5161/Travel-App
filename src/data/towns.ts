// Towns the home screen can name as "where you are", worked out on the phone: every Kerala district
// town, and the cities people from Kerala most often live in. No lookup service, so the location
// never leaves the phone, and nothing is paid for. Centres are approximate; the answer is "you're
// around Kochi", not an address.

import { distanceKm, type LatLng } from '@/lib/geo';

type Town = { name: string; centre: LatLng };

const TOWNS: Town[] = [
  // Kerala: the 14 district towns.
  { name: 'Thiruvananthapuram', centre: { lat: 8.524, lng: 76.937 } },
  { name: 'Kollam', centre: { lat: 8.893, lng: 76.614 } },
  { name: 'Pathanamthitta', centre: { lat: 9.265, lng: 76.787 } },
  { name: 'Alappuzha', centre: { lat: 9.498, lng: 76.339 } },
  { name: 'Kottayam', centre: { lat: 9.592, lng: 76.522 } },
  { name: 'Idukki', centre: { lat: 9.85, lng: 76.97 } },
  { name: 'Kochi', centre: { lat: 9.982, lng: 76.3 } },
  { name: 'Thrissur', centre: { lat: 10.528, lng: 76.214 } },
  { name: 'Palakkad', centre: { lat: 10.787, lng: 76.655 } },
  { name: 'Malappuram', centre: { lat: 11.051, lng: 76.071 } },
  { name: 'Kozhikode', centre: { lat: 11.259, lng: 75.78 } },
  { name: 'Wayanad', centre: { lat: 11.609, lng: 76.083 } },
  { name: 'Kannur', centre: { lat: 11.875, lng: 75.37 } },
  { name: 'Kasaragod', centre: { lat: 12.5, lng: 74.987 } },
  // Beyond Kerala.
  { name: 'Bengaluru', centre: { lat: 12.972, lng: 77.595 } },
  { name: 'Mysuru', centre: { lat: 12.296, lng: 76.639 } },
  { name: 'Mangaluru', centre: { lat: 12.914, lng: 74.856 } },
  { name: 'Coimbatore', centre: { lat: 11.017, lng: 76.956 } },
  { name: 'Chennai', centre: { lat: 13.083, lng: 80.271 } },
  { name: 'Hyderabad', centre: { lat: 17.385, lng: 78.487 } },
  { name: 'Goa', centre: { lat: 15.491, lng: 73.828 } },
  { name: 'Pune', centre: { lat: 18.52, lng: 73.857 } },
  { name: 'Mumbai', centre: { lat: 19.076, lng: 72.878 } },
  { name: 'Ahmedabad', centre: { lat: 23.023, lng: 72.571 } },
  { name: 'Delhi', centre: { lat: 28.614, lng: 77.209 } },
  { name: 'Kolkata', centre: { lat: 22.573, lng: 88.364 } },
];

/** Further than this from every town, and the app says so rather than naming the wrong one. */
const NEAR_KM = 35;

/** The nearest town on the list, or null when none is close enough to be honest about. */
export function nearestTown(at: LatLng): string | null {
  let best: { name: string; km: number } | null = null;
  for (const t of TOWNS) {
    const km = distanceKm(at, t.centre);
    if (!best || km < best.km) best = { name: t.name, km };
  }
  return best && best.km <= NEAR_KM ? best.name : null;
}
