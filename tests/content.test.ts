import assert from 'node:assert/strict';
import { test } from 'node:test';
import { citySchema, locationSchema, optionalDate, slugify, tripLocationSchema, tripSchema } from '../src/lib/validation/content';
import { databaseError, validationState } from '../src/lib/admin/form-state';

const id = '00000000-0000-4000-8000-000000000001';
const trip = { title: 'Historical journey', slug: 'historical-journey', status: 'draft', start_date: '', end_date: '', purpose: '', description: '', editorial_order: '' };
test('Trip form accepts unknown and partial dates without fabricating values', () => {
  assert.equal(tripSchema.parse(trip).start_date, null);
  assert.equal(tripSchema.parse({ ...trip, end_date: '1999-01-01' }).start_date, null);
  assert.equal(tripSchema.parse({ ...trip, start_date: '1999-01-01' }).end_date, null);
  assert.equal(tripSchema.parse({ ...trip, purpose: 'photography', status: 'published' }).purpose, 'photography');
});
test('Trip validation rejects reversed dates, missing titles and unsupported purpose', () => {
  const result = tripSchema.safeParse({ ...trip, start_date: '2024-02-01', end_date: '2024-01-01' });
  assert.equal(result.success, false);
  if (!result.success) {
    const state = validationState(trip, result.error.issues);
    assert.ok(state.errors?.end_date);
    assert.deepEqual(state.values, trip);
  }
  assert.equal(tripSchema.safeParse({ ...trip, title: ' ' }).success, false);
  assert.equal(tripSchema.safeParse({ ...trip, purpose: 'holiday' }).success, false);
});
test('calendar dates and association ordering are optional but validated', () => {
  for (const date of ['2023-02-29', '2024-04-31', '0000-01-01', '2024-1-1']) assert.equal(optionalDate.safeParse(date).success, false);
  assert.equal(optionalDate.parse('2024-02-29'), '2024-02-29');
  assert.deepEqual(tripLocationSchema.parse({ location_id: id, sequence: '', visited_at: '' }), { location_id: id, sequence: null, visited_at: null });
  for (const sequence of ['-1', '1.5', 'NaN']) assert.equal(tripLocationSchema.safeParse({ location_id: id, sequence, visited_at: '' }).success, false);
});
test('Location validates City identity and optional paired representative coordinates', () => {
  const location = { name: 'Castle', slug: 'castle', city_id: id, latitude: '', longitude: '', description: '', status: 'draft', editorial_order: '' };
  assert.equal(locationSchema.parse(location).latitude, null);
  assert.equal(locationSchema.safeParse({ ...location, latitude: '1.2' }).success, false);
  assert.equal(locationSchema.safeParse({ ...location, latitude: '91', longitude: '0' }).success, false);
  assert.equal(locationSchema.safeParse({ ...location, city_id: '' }).success, false);
  assert.equal(locationSchema.parse({ ...location, latitude: '1.2', longitude: '103.8' }).longitude, 103.8);
});
test('City form supports existing Country selection and simple new Country creation', () => {
  const city = { name: 'London', slug: 'london', country_id: id, latitude: '', longitude: '', country_name: '', country_slug: '', country_code: '' };
  assert.equal(citySchema.safeParse(city).success, true);
  assert.equal(citySchema.safeParse({ ...city, country_id: 'new' }).success, false);
  assert.equal(citySchema.parse({ ...city, country_id: 'new', country_name: 'United Kingdom', country_slug: 'united-kingdom', country_code: 'gb' }).country_code, 'GB');
  assert.equal(slugify('  São Paulo  '), 'sao-paulo');
  assert.equal(slugify('北京'), ''); // Owner supplies an ASCII URL name; no invented translation.
});
test('database errors show safe actionable messages without exposing database details', () => {
  assert.match(databaseError({ code: '23505', message: 'private SQL detail' }), /already|unique|exists/i);
  assert.doesNotMatch(databaseError({ code: 'XX000', message: 'secret' }), /secret/);
  assert.match(databaseError({ code: 'PGRST202' }), /migration/i);
});
