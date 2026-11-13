import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';

import { FavoriteService } from './favorite.service';
import { Pdb } from '../data/pdb';

class StorageMock {
  data = new Map<string, any>();

  async create() {
    return this;
  }

  async get(key: string) {
    return this.data.get(key);
  }

  async set(key: string, value: any) {
    this.data.set(key, value);
    return value;
  }
}

describe('FavoriteService', () => {
  let storage: StorageMock;

  const pdb = (id: string, title = 'Title'): Pdb => ({ id, title, desc: 'Desc' });

  const createService = (): FavoriteService => {
    TestBed.configureTestingModule({
      providers: [{ provide: Storage, useValue: storage }]
    });
    return TestBed.inject(FavoriteService);
  };

  beforeEach(() => {
    storage = new StorageMock();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts with an empty list and persists it', async () => {
    const service = createService();
    await service.whenReady();

    expect(service.getFavorites()).toEqual([]);
    expect(storage.data.get('favorites')).toEqual([]);
  });

  it('loads persisted favorites', async () => {
    storage.data.set('favorites', [pdb('1abc')]);

    const service = createService();
    await service.whenReady();

    expect(service.getFavorites()).toEqual([pdb('1abc')]);
  });

  it('adds a favorite once even when the object identity differs', async () => {
    const service = createService();

    await service.addFavorite(pdb('1abc', 'First title'));
    await service.addFavorite(pdb('1abc', 'Second title'));

    expect(service.getFavorites().length).toBe(1);
    expect(await storage.get('favorites')).toEqual([pdb('1abc', 'First title')]);
  });

  it('reports whether a PDB is a favorite by id', async () => {
    const service = createService();
    await service.addFavorite(pdb('1abc'));

    expect(service.isFavorite(pdb('1abc', 'Another title'))).toBeTrue();
    expect(service.favoritesContains(pdb('2xyz'))).toBeFalse();
  });

  it('removes a favorite by id and persists the change', async () => {
    const service = createService();
    await service.addFavorite(pdb('1abc'));

    await service.removeFavorite(pdb('1abc', 'Another title'));

    expect(service.getFavorites()).toEqual([]);
    expect(await storage.get('favorites')).toEqual([]);
  });
});
