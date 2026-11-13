import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { Pdb } from '../data/pdb'

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  private _storage: Storage | null = null;
  private favorites: Pdb[] = [];
  private ready: Promise<void>;

  constructor(private storage: Storage) {
    this.ready = this.init();
  }

  private async init() {
    this._storage = await this.storage.create();
    await this.loadData();
  }

  private async loadData() {
    if (!this._storage) {
      return;
    }
    const stored = await this._storage.get('favorites');
    this.favorites = Array.isArray(stored) ? stored : [];
    if (!Array.isArray(stored)) {
      await this._storage.set('favorites', this.favorites);
    }
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  getFavorites(): Pdb[] {
    return this.favorites;
  }

  private samePdb(a: Pdb, b: Pdb): boolean {
    return !!a && !!b && a.id === b.id;
  }

  favoritesContains(favorite: Pdb): boolean {
    return this.favorites.some(elm => this.samePdb(elm, favorite));
  }

  isFavorite(favorite: Pdb): boolean {
    return this.favoritesContains(favorite);
  }

  async addFavorite(favorite: Pdb) {
    await this.ready;
    if (!this.favorites.some(elm => this.samePdb(elm, favorite))) {
      this.favorites.push(favorite);
      await this._storage?.set('favorites', this.favorites);
    }
  }

  async removeFavorite(favorite: Pdb) {
    await this.ready;
    this.favorites = this.favorites.filter(el => !this.samePdb(el, favorite));
    await this._storage?.set('favorites', this.favorites);
  }
}
