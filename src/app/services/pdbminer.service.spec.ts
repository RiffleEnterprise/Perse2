import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { PdbminerService } from './pdbminer.service';

describe('PdbminerService', () => {
  let service: PdbminerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(PdbminerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
