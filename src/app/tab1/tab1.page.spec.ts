import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { IonicModule } from '@ionic/angular';

import { Tab1Page } from './tab1.page';
import { FavoriteService } from '../services/favorite.service';

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Tab1Page],
      imports: [IonicModule.forRoot(), HttpClientTestingModule],
      providers: [{
        provide: FavoriteService,
        useValue: {
          whenReady: () => Promise.resolve(),
          getFavorites: () => [],
          favoritesContains: () => false,
          isFavorite: () => false,
          addFavorite: () => Promise.resolve(),
          removeFavorite: () => Promise.resolve()
        }
      }]
    });

    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
