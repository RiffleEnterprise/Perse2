import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PdbminerService } from './pdbminer.service';

const SEARCH_URL = 'https://search.rcsb.org/rcsbsearch/v2/query';
const STRUCTURE_URL = 'https://files.rcsb.org/view';

describe('PdbminerService', () => {
  let service: PdbminerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(PdbminerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POSTs a full-text query and normalizes compact results', async () => {
    const promise = service.lookFor('hemoglobin');

    const request = httpMock.expectOne(SEARCH_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.query.service).toBe('full_text');
    expect(request.request.body.query.parameters.value).toBe('hemoglobin');
    expect(request.request.body.request_options.results_verbosity).toBe('compact');

    request.flush({ total_count: 2, result_set: ['2PGH', '3PEL'] });

    const response = await promise;
    expect(response.result_set).toEqual([
      { identifier: '2PGH' },
      { identifier: '3PEL' }
    ]);
    expect(response.total_count).toBe(2);
  });

  it('matches a four-character input as an exact entry id', async () => {
    const promise = service.lookFor('4ubb');

    const request = httpMock.expectOne(SEARCH_URL);
    expect(request.request.body.query.service).toBe('text');
    expect(request.request.body.query.parameters).toEqual({
      attribute: 'rcsb_entry_container_identifiers.entry_id',
      operator: 'exact_match',
      value: '4UBB'
    });

    request.flush({ total_count: 1, result_set: ['4UBB'] });
    expect((await promise).result_set).toEqual([{ identifier: '4UBB' }]);
  });

  it('caches repeated queries, ignoring case', async () => {
    const first = service.lookFor('hemoglobin');
    httpMock.expectOne(SEARCH_URL).flush({ total_count: 1, result_set: ['2PGH'] });
    await first;

    const cached = await service.lookFor('Hemoglobin');
    httpMock.expectNone(SEARCH_URL);
    expect(cached.result_set).toEqual([{ identifier: '2PGH' }]);
  });

  it('resolves null when the query matches nothing', async () => {
    const notFound = service.lookFor('zzzznotreal');
    httpMock.expectOne(SEARCH_URL).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await notFound).toBeNull();

    const empty = service.lookFor('anotherterm');
    httpMock.expectOne(SEARCH_URL).flush(null, { status: 204, statusText: 'No Content' });
    expect(await empty).toBeNull();
  });

  it('resolves null when the query is rejected with HTTP 400', async () => {
    const promise = service.lookFor('not a protein');

    httpMock.expectOne(SEARCH_URL).flush(
      { message: 'invalid' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(await promise).toBeNull();
  });

  it('retries server errors, then rethrows', fakeAsync(() => {
    let outcome = 'pending';
    service.lookFor('offline').then(
      () => outcome = 'resolved',
      () => outcome = 'rejected'
    );

    httpMock.expectOne(SEARCH_URL).flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    tick(500);
    httpMock.expectOne(SEARCH_URL).flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    tick(1000);
    httpMock.expectOne(SEARCH_URL).flush('unavailable', { status: 503, statusText: 'Service Unavailable' });

    flushMicrotasks();
    expect(outcome).toBe('rejected');
  }));

  it('fetches and caches structure files through HttpClient', async () => {
    const first = service.getStructure('4ubb').toPromise();

    const request = httpMock.expectOne(`${STRUCTURE_URL}/4UBB.pdb`);
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('text');
    request.flush('HEADER\nTITLE');

    expect(await first).toBe('HEADER\nTITLE');

    const cached = await service.getStructure('4UBB').toPromise();
    httpMock.expectNone(`${STRUCTURE_URL}/4UBB.pdb`);
    expect(cached).toBe('HEADER\nTITLE');
  });
});
