import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PdbminerService {

  constructor(private http: HttpClient) { }

  async lookFor(text: string) {
    try {
      return await this.http.get('https://search.rcsb.org/rcsbsearch/v2/query', {
        params: {
          json: JSON.stringify(
            {
              return_type: 'entry',
              query: {
                type: 'terminal',
                service: 'full_text',
                parameters: {
                  value: text
                }
              }
            })
        }
      }).toPromise();
    }
    catch (error) {
      if (error && error.status === 400) {
        return null;
      }
      throw error;
    }
  }
}
