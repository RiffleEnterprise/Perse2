import { Component, OnDestroy } from '@angular/core';
import { Platform } from '@ionic/angular';
import {PdbminerService} from '../services/pdbminer.service'
import {Pdb} from '../data/pdb'
import {FavoriteService} from '../services/favorite.service'
import {PdbfocusService} from '../services/pdbfocus.service'
import { AlertController } from '@ionic/angular';
import { Keyboard } from '@ionic-native/keyboard/ngx';
import { EMPTY, from, of, Subject } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';
const pv= require('bio-pv/bio-pv.min')


@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  providers: [Keyboard]
})
/*
----The viewer to display molecules----
*/
export class Tab1Page implements OnDestroy {
  //all our pdb information
  structure:any;
  structureId = '4ubb';
  structureTitle;
  structureDesc;
  //used by protein viewer
  viewer:any;
  //used for rcsb query
  searchQuery:string;
  results
  //for cycling pdbs? (probably a better way to do this)
  currentPdb:number=1 ;
  totalPdbs:number=1;
  //keeps track if current protein is a favorite
  favorite:boolean;
  //keeps track if currently in loading mode
  loading:boolean = false;
  //guards against Enter firing more than one search event
  private searchInFlight:boolean = false;
  private lastQuery:string = '';
  private searchToken:number = 0;
  private searchTrigger = new Subject<string>();
  private destroy$ = new Subject<void>();
  private onResize = () => {
    if(this.viewer){
      this.viewer.fitParent()
    }
  };
  constructor(
    private favoriteService:FavoriteService, 
    private pdbminer:PdbminerService,
    private platform:Platform,
    private pdbFocusService:PdbfocusService,
    private alertController: AlertController,
    private keyboard:Keyboard
    ){}
  
  ngOnInit(){
    let outlineBool = true
    if(this.platform.is('ipad')){
      outlineBool = false
    }
    const viewerElement = document.getElementById('viewer')
    if(!viewerElement){
      return
    }
    this.viewer = pv.Viewer(viewerElement,
    { quality : 'high', width: this.platform.width(), height: this.platform.height(),
      antialias : true, outline : outlineBool});
    window.addEventListener('resize', this.onResize)
    window.addEventListener('orientationchange', this.onResize)
    setTimeout(() => this.onResize(), 0)

    // switchMap cancels the previous search when a new one is submitted.
    this.searchTrigger.pipe(
      switchMap(query => {
        const token = ++this.searchToken
        return this.pdbminer.search(query).pipe(
          switchMap(response => {
            if(token !== this.searchToken){
              return EMPTY
            }
            if(!response || !response.result_set || response.result_set.length === 0){
              return from(this.presentNoProtein())
            }
            this.results = response
            this.totalPdbs = response.result_set.length
            this.currentPdb = 1
            this.structureId = response.result_set[0].identifier
            this.pdbFocusService.setFocus(this.structureId)
            return this.loadStructure$(this.structureId).pipe(
              tap(() => this._checkIfCurrentIsFavorite())
            )
          }),
          catchError(err => {
            if(token === this.searchToken){
              this.handleRequestError(err)
            }
            return EMPTY
          }),
          finalize(() => {
            if(token === this.searchToken){
              this.searchInFlight = false
              this.loading = false
            }
          })
        )
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  ngOnDestroy(){
    this.destroy$.next()
    this.destroy$.complete()
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('orientationchange', this.onResize)
  }

  async ionViewWillEnter(){
    this.structureId = this.pdbFocusService.getFocus()
    await this.favoriteService.whenReady()
    await this.requestPDB()
    await this._checkIfCurrentIsFavorite()
  }

  ionViewDidEnter(){
    this.onResize()
    this._checkIfCurrentIsFavorite()
  }

  onSearchInput(event: any){
    this.searchQuery = (event && event.target && event.target.value) || ''
  }

  onSearch(event: any){
    const targetValue = event && event.target && event.target.value
    const value = this.searchQuery || targetValue || ''
    const query = (value || '').trim()
    if(!query){
      return
    }
    // keydown, keyup and the native search event can fire for a single Enter,
    // so only submit again when the query actually changes.
    const cacheKey = query.toLowerCase()
    if(this.searchInFlight && cacheKey === this.lastQuery){
      return
    }
    this.lastQuery = cacheKey
    this.searchInFlight = true
    this.loading = true
    if(this.platform.is('hybrid')){
      this.keyboard.hide()
    }
    this.searchTrigger.next(query)
  }

  private handleRequestError(err: any){
    if(err && (err.status === 400 || err.status === 404)){
      return this.presentNoProtein()
    }
    if(err && err.status === 0){
      return this.presentNoInternet()
    }
    return this.presentSearchUnavailable()
  }

  private loadStructure$(structureId: string){
    return this.pdbminer.getStructure(structureId).pipe(
      map(pdbText => {
        const splitResponse = pdbText.split('\n')
        //need to write a custom rebuilder
        this.structureTitle = this._removeDateFromTitle(this.cleanPDBInfo(splitResponse[0]))
        this.structureDesc = this.cleanPDBInfo(splitResponse[1])
        //----
        this.structure = pv.io.pdb(pdbText)
        this.preset()
      }),
      catchError(err => {
        this.handleRequestError(err)
        return of(undefined)
      })
    )
  }
  
  _checkIfCurrentIsFavorite(){
    console.log( )
    if(this.favoriteService.isFavorite({
      id: this.structureId,
      title: this.structureTitle,
      desc: this.structureDesc})){
      this.favorite = true
    }
    else{
      this.favorite = false
    }
  }

  cleanPDBInfo(info:string){
   let infoArray = info.split(' ')
   infoArray.shift()
   let i
   let finalInfo =""
   for(i =0;i<infoArray.length;i++){
     if(infoArray[i] != ''){
        finalInfo += infoArray[i] + ' '
     }
   }
   return finalInfo
  }

  _removeDateFromTitle(title:string){
    let titleArrray = title.split(' ')
    console.log(titleArrray)
    titleArrray.splice(2,1)
    titleArrray.splice(3,1)
    console.log(titleArrray)
    let newTitle =  titleArrray.join(" ")
    return newTitle
  }

  async requestPDB(): Promise<void> {
    this.loading = true
    try{
      await this.loadStructure$(this.structureId).toPromise()
    }
    finally{
      this.loading = false
    }
  }

  async nextPdb(){
    if(this.currentPdb < this.totalPdbs){
      this.currentPdb += 1
      this.structureId = this.results.result_set[this.currentPdb-1].identifier
      this.pdbFocusService.setFocus(this.structureId)
      await this.requestPDB()
      await this._checkIfCurrentIsFavorite()
    }
  }
  async prevPdb(){
    if(this.currentPdb > 1){
      this.currentPdb -= 1
      this.structureId = this.results.result_set[this.currentPdb-1].identifier
      this.pdbFocusService.setFocus(this.structureId)
      await this.requestPDB()
      await this._checkIfCurrentIsFavorite()
    }
  }

  preset() {
    this.viewer.clear();
    var ligand = this.structure.select({rnames : ['RVP', 'SAH']});
    this.viewer.ballsAndSticks('ligand', ligand);
    this.viewer.cartoon('protein', this.structure);
    this.viewer.centerOn(this.structure);
  }

  ballsAndSticks() {
    this.viewer.clear();
    try{
      this.viewer.ballsAndSticks('structure', this.structure);
    }
    catch{
      
    }
  }
  cartoon() {
    this.viewer.clear();
    try{
      this.viewer.cartoon('structure', this.structure);
    }
    catch{
    }
  }
  lines() {
    this.viewer.clear();
    try{
    this.viewer.lines('structure', this.structure);
    }
    catch(error){
      console.error('Unable to render structure', error)
    }
  }

  spheres() {
    this.viewer.clear();
    try{
    this.viewer.spheres('structure', this.structure);
    }
    catch(error){
      console.error('Unable to render structure', error)
    }
  }

  async toggleFavorite(){
    if(this.favorite){
      await this.removeFavorite()
    }
    else{
      await this.addFavorite()
    }
  }

  async addFavorite(){
    this.favorite = true
    await this.favoriteService.addFavorite({
      id: this.structureId,
      title: this.structureTitle,
      desc: this.structureDesc})
  }

  async removeFavorite(){
    this.favorite = false
    await this.favoriteService.removeFavorite({
      id: this.structureId,
      title: this.structureTitle,
      desc: this.structureDesc})
  }

  async presentNoInternet () {
    const alert = await this.alertController.create({
      header: 'No Internet Connection',
      message: 'We could not reach the RCSB database. Check your internet connection and try again.',
      buttons: ['OK']
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);
  }

  async presentNoProtein () {
    const alert = await this.alertController.create({
      header: 'Protein Not Found',
      message: 'No structures matched your search in the RCSB database. Try another protein name or PDB ID.',
      buttons: ['OK']
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);
  }

  async presentSearchUnavailable () {
    const alert = await this.alertController.create({
      header: 'Search Unavailable',
      message: 'The RCSB database is having trouble right now. Please try again in a moment.',
      buttons: ['OK']
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);
  }

}