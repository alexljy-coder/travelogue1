import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverEligible, photoPublicationErrors, stayPublicationErrors, type PhotoForPublishing, type PhotoParents } from '../src/lib/validation/publishing';

const travel: PhotoForPublishing = { status: 'published', classification: 'nice', context: 'travel', processing_status: 'ready', featured: false, trip_id: 'trip', location_id: 'location', hotel_id: null };
const parents: PhotoParents = { trip: { id: 'trip', status: 'published' }, location: { id: 'location', status: 'published' }, tripLocationAssociated: true };
const hotel: PhotoForPublishing = { ...travel, context: 'hotel', trip_id: null, location_id: null, hotel_id: 'hotel' };
const hotelParents: PhotoParents = { hotel: { id: 'hotel', status: 'published' } };

test('publishing preflight requires exact published parents and actual membership', () => {
  assert.deepEqual(photoPublicationErrors(travel, parents), []);
  assert.deepEqual(photoPublicationErrors(hotel, hotelParents), []);
  assert.ok(photoPublicationErrors(travel, { ...parents, trip: { id: 'trip', status: 'draft' } }).length);
  assert.ok(photoPublicationErrors(travel, { ...parents, location: { id: 'different', status: 'published' } }).length);
  assert.ok(photoPublicationErrors(travel, { ...parents, tripLocationAssociated: false }).length);
  assert.ok(photoPublicationErrors(hotel, { hotel: { ...hotelParents.hotel!, status: 'draft' } }).length);
  assert.ok(photoPublicationErrors({ ...travel, processing_status: 'pending' }, parents).length);
  assert.deepEqual(photoPublicationErrors({ ...travel, status: 'draft', trip_id: null, location_id: null }, {}), []);
});

test('Featured is not allowed for Draft or Record; context is exclusive', () => {
  assert.ok(photoPublicationErrors({ ...travel, status: 'draft', featured: true }, parents).length);
  assert.ok(photoPublicationErrors({ ...travel, classification: 'record', featured: true }, parents).length);
  assert.ok(photoPublicationErrors({ ...travel, hotel_id: 'hotel' }, parents).length);
  assert.ok(photoPublicationErrors({ ...hotel, trip_id: 'trip' }, hotelParents).length);
});

test('covers require visible Nice photos associated with their exact target', () => {
  assert.equal(coverEligible(travel, parents, { type: 'trip', id: 'trip' }), true);
  assert.equal(coverEligible(travel, parents, { type: 'trip', id: 'other' }), false);
  assert.equal(coverEligible(travel, parents, { type: 'location', id: 'location' }), true);
  assert.equal(coverEligible({ ...travel, classification: 'record' }, parents, { type: 'trip', id: 'trip' }), false);
  assert.equal(coverEligible(travel, { ...parents, trip: { id: 'trip', status: 'draft' } }, { type: 'trip', id: 'trip' }), false);
  assert.equal(coverEligible(hotel, hotelParents, { type: 'hotel', id: 'hotel' }), true);
  assert.equal(coverEligible(hotel, hotelParents, { type: 'hotel', id: 'other' }), false);
  assert.equal(coverEligible(hotel, hotelParents, { type: 'trip', id: 'trip' }), false);
});

test('Stay publication requires both Trip and Hotel but Draft does not', () => {
  assert.deepEqual(stayPublicationErrors('published', 'published', 'published'), []);
  assert.ok(stayPublicationErrors('published', 'published', 'draft').length);
  assert.deepEqual(stayPublicationErrors('draft', 'draft', 'draft'), []);
});
