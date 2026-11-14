import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, mergeMap, retryWhen, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PdbSearchHit {
  identifier: string;
  score?: number;
}

export interface PdbSearchResponse {
  total_count: number;
  result_set: PdbSearchHit[];
  [key: string]: any;
}

// Cap the large result sets RCSB can return (e.g. a generic full-text query
// can match tens of thousands of entries) while keeping enough to page through.
const MAX_RESULTS = 50;
const SEARCH_TIMEOUT_MS = 15000;
const STRUCTURE_TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;

function isRetryable(error: any): boolean {
  if (!error) {
    return false;
  }
  if (error.name === 'TimeoutError') {
    return true;
  }
  const status = error.status;
  return status === 0 || status === 429 || (typeof status === 'number' && status >= 500);
}

function retryWithBackoff<T>() {
  return (source: Observable<T>) => source.pipe(
    retryWhen(errors => errors.pipe(
      mergeMap((error, attempt) => {
        if (attempt >= MAX_RETRIES || !isRetryable(error)) {
          return throwError(error);
        }
        return timer(500 * Math.pow(2, attempt));
      })
    ))
  );
}

@Injectable({
  providedIn: 'root'
})
export class PdbminerService {
  private searchCache = new Map<string, PdbSearchResponse>();
  private structureCache = new Map<string, string>();

  constructor(private http: HttpClient) { }

  private buildSearchBody(text: string) {
    // A four-character code is a PDB ID, so match it exactly instead of a
    // fuzzy full-text search (which matches things like "0000" to thousands).
    const isPdbId = /^[0-9a-z]{4}$/i.test(text);
    const query = isPdbId
      ? {
          type: 'terminal',
          service: 'text',
          parameters: {
            attribute: 'rcsb_entry_container_identifiers.entry_id',
            operator: 'exact_match',
            value: text.toUpperCase()
          }
        }
      : {
          type: 'terminal',
          service: 'full_text',
          parameters: {
            value: text
          }
        };

    return {
      query,
      return_type: 'entry',
      request_options: {
        paginate: { start: 0, rows: MAX_RESULTS },
        results_verbosity: 'compact'
      }
    };
  }

  private normalizeResponse(raw: any): PdbSearchResponse | null {
    if (!raw || !Array.isArray(raw.result_set) || raw.result_set.length === 0) {
      return null;
    }
    const result_set: PdbSearchHit[] = raw.result_set.map((entry: any) =>
      typeof entry === 'string'
        ? { identifier: entry }
        : { identifier: entry.identifier, score: entry.score });

    return {
      ...raw,
      result_set,
      total_count: typeof raw.total_count === 'number' ? raw.total_count : result_set.length
    };
  }

  search(text: string): Observable<PdbSearchResponse | null> {
    const query = (text || '').trim();
    if (!query) {
      return of(null);
    }

    const cacheKey = query.toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.http.post<any>(environment.rcsb.searchUrl, this.buildSearchBody(query)).pipe(
      timeout(SEARCH_TIMEOUT_MS),
      retryWithBackoff(),
      map(raw => {
        const response = this.normalizeResponse(raw);
        if (response) {
          this.searchCache.set(cacheKey, response);
        }
        return response;
      }),
      catchError((error: HttpErrorResponse) => {
        if (error && (error.status === 400 || error.status === 404)) {
          return of(null);
        }
        return throwError(error);
      })
    );
  }

  lookFor(text: string): Promise<PdbSearchResponse | null> {
    return this.search(text).toPromise();
  }

  getStructure(structureId: string): Observable<string> {
    const id = (structureId || '').trim().toUpperCase();
    const cached = this.structureCache.get(id);
    if (cached !== undefined) {
      return of(cached);
    }

    return this.http.get(
      `${environment.rcsb.structureUrl}/${encodeURIComponent(id)}.pdb`,
      { responseType: 'text' }
    ).pipe(
      timeout(STRUCTURE_TIMEOUT_MS),
      retryWithBackoff(),
      tap(text => this.structureCache.set(id, text))
    );
  }
}
