/**
 * Thin wrappers around the backend REST API used in E2E test setup.
 * Calling these directly avoids driving the UI for every piece of test
 * fixture data, making tests faster and less brittle.
 */

const API = 'http://localhost:3001/api';

export interface DonationRecord {
  id: string;
  status: string;
  description: string;
  donor_id: string;
}

/**
 * Creates a donation via the API on behalf of `token`'s owner.
 * Returns the created donation record.
 */
export async function createDonation(
  token: string,
  coords: { lat: number; lng: number },
  description: string,
): Promise<DonationRecord> {
  const res = await fetch(`${API}/donations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      latitude: coords.lat,
      longitude: coords.lng,
      description,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`createDonation failed (${res.status}): ${body.error ?? res.statusText}`);
  }

  const { donation } = await res.json();
  return donation as DonationRecord;
}

/**
 * Confirms a donation as the user identified by `token`.
 * Coords must be within MAX_CONFIRM_DISTANCE_KM (5 km) of the donor's coords.
 */
export async function confirmDonation(
  token: string,
  donationId: string,
  coords: { lat: number; lng: number },
): Promise<DonationRecord> {
  const res = await fetch(`${API}/donations/${donationId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ latitude: coords.lat, longitude: coords.lng }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`confirmDonation failed (${res.status}): ${body.error ?? res.statusText}`);
  }

  const { donation } = await res.json();
  return donation as DonationRecord;
}
