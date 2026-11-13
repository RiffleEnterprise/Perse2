import { Component,ElementRef, ViewChildren} from '@angular/core';
import { Platform } from '@ionic/angular';
import {PdbminerService} from '../services/pdbminer.service'
import {Pdb} from '../data/pdb'
import {FavoriteService} from '../services/favorite.service'
import {PdbfocusService} from '../services/pdbfocus.service'
import { AlertController } from '@ionic/angular';
import { Keyboard } from '@ionic-native/keyboard/ngx';
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
export class Tab1Page {
  @ViewChildren('searchText') searchText;
  //attributes for this page
  windownWidth: number;
  windowHeight: number;
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
  //for a fix for search bar
  popSearch:boolean = true;
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
    this.windowHeight = this.platform.height()
    this.windownWidth = this.platform.width()
    this.viewer = pv.Viewer(document.getElementById('viewer'), 
    { quality : 'high', width: this.windownWidth, height : this.windowHeight-this.windowHeight*0.07,
      antialias : true, outline : outlineBool});
  }

  async ionViewWillEnter(){
    this.structureId = this.pdbFocusService.getFocus()
    await this.favoriteService.whenReady()
    await this.requestPDB()
    await this._checkIfCurrentIsFavorite()
  }

  ionViewDidEnter(){
    this._checkIfCurrentIsFavorite()
  }

  async search(event, first: boolean){
    this.loading = true
    this.keyboard.hide()
    try {
      const response: any = await this.pdbminer.lookFor(this.searchQuery)
      if(!response || !response.result_set || response.result_set.length === 0){
        if(first){
          setTimeout(() => {this.search(event,false)}, 3000);
        }
        else{
          await this.presentNoProtein()
        }
        return
      }
      this.results = response
      this.totalPdbs = response.result_set.length
      this.currentPdb = 1
      this.structureId = response.result_set[0].identifier
      this.pdbFocusService.setFocus(this.structureId)
      await this.requestPDB()
      await this._checkIfCurrentIsFavorite()
    }
    catch(err){
      if(err && err.status == 400){
        await this.presentNoProtein()
      }
      else{
        await this.presentNoInternet()
      }
    }
    finally {
      this.loading = false
      this._popSearch()
    }
  }
    

  _popSearch(){
    console.log("popping")
    this.popSearch =false
    setTimeout(() => {this.popSearch = true}, 500);
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

  requestPDB(): Promise<void> {
    this.loading = true
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', 'https://files.rcsb.org/view/' + this.structureId + '.pdb')

      xhr.onload = () => {
        try{
          if(xhr.status < 200 || xhr.status >= 300){
            throw new Error('HTTP ' + xhr.status)
          }
          const splitResponse = xhr.responseText.split('\n')
          //need to write a custom rebuilder
          this.structureTitle = this._removeDateFromTitle(this.cleanPDBInfo(splitResponse[0]))
          this.structureDesc = this.cleanPDBInfo(splitResponse[1])
          //----
          this.structure = pv.io.pdb(xhr.responseText)
          this.preset()
        }
        catch{
          this.presentNoInternet()
        }
        finally {
          this.loading = false
          resolve()
        }
      }

      xhr.onerror = () => {
        this.loading = false
        this.presentNoInternet()
        resolve()
      }

      xhr.send()
    })
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
      header: 'No Internet',
      message: 'Can not establish an internet connection.',
      buttons: ['OK']
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);
  }

  async presentNoProtein () {
    const alert = await this.alertController.create({
      header: 'Protein Not Found',
      message: 'Your protein can no be found in the RCSB database.',
      buttons: ['OK']
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    console.log('onDidDismiss resolved with role', role);
  }

}