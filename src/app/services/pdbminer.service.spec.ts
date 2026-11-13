import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PdbminerService } from './pdbminer.service';

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

  it('sends the full-text query and returns the response', async () => {
    const response = { result_set: [{ identifier: '4UBB' }] };

    const promise = service.lookFor('hemoglobin');

    const request = httpMock.expectOne(req => req.url === 'https://search.rcsb.org/rcsbsearch/v2/query');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('json')).toContain('hemoglobin');

    request.flush(response);

    expect(await promise).toEqual(response);
  });

  it('resolves null when the query is rejected with HTTP 400', async () => {
    const promise = service.lookFor('not a protein');

    httpMock.expectOne(() => true).flush(
      { message: 'invalid' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(await promise).toBeNull();
  });

  it('rethrows network and server errors', async () => {
    const promise = service.lookFor('offline');

    httpMock.expectOne(() => true).flush(
      'unavailable',
      { status: 503, statusText: 'Service Unavailable' }
    );

    await expectAsync(promise).toBeRejected();
  });
});
