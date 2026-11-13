import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { IonicModule } from '@ionic/angular';
import { AdMob } from '@admob-plus/ionic/ngx';

import { Tab2Page } from './tab2.page';
import { FavoriteService } from '../services/favorite.service';

class BannerAdMock {
  show() { }
  hide() { }
}

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Tab2Page],
      imports: [IonicModule.forRoot(), RouterTestingModule],
      providers: [
        {
          provide: FavoriteService,
          useValue: {
            whenReady: () => Promise.resolve(),
            getFavorites: () => [],
            favoritesContains: () => false,
            isFavorite: () => false,
            addFavorite: () => Promise.resolve(),
            removeFavorite: () => Promise.resolve()
          }
        },
        {
          provide: AdMob,
          useValue: {
            start: () => Promise.resolve(),
            requestTrackingAuthorization: () => Promise.resolve(),
            BannerAd: BannerAdMock,
            on: () => ({ subscribe: () => { } })
          }
        }
      ]
    });

    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
