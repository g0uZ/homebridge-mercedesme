'use strict';

const Logger = require('../helper/logger.js');
const MeApi = require('../helper/me.js');

class CarAccessory {

  constructor (api, accessory, accessories, storage) {

    this.api = api;
    this.accessory = accessory;
    this.accessories = accessories;
    this.storage = storage;
    
    this.me = new MeApi(this.accessory, this.api);

    this.getService();

  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // Services
  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  async getService () {
  
    let serviceLock = this.accessory.getService(this.api.hap.Service.LockMechanism);
    let serviceBattery = this.accessory.getService(this.api.hap.Service.BatteryService);
    let serviceDoor = this.accessory.getService('Doors');                                    //check with name, because contactSensor already exist
    let serviceWindow = this.accessory.getService('Windows');                                //check with name, because contactSensor already exist
    let serviceLight = this.accessory.getService(this.api.hap.Service.Lightbulb);
    
    //Car Lock
  
    if (!serviceLock) {
      Logger.info('Adding LockMechanism service', this.accessory.displayName);
      serviceLock = this.accessory.addService(this.api.hap.Service.LockMechanism, 'Lock', 'lock');
    }
    
    serviceLock
      .getCharacteristic(this.api.hap.Characteristic.LockTargetState)
      .on('set', (state, callback) => {
      
        Logger.info('Can not change lock state. Not supported at the moment!', this.accessory.displayName);
            
        setTimeout(() =>{
        
          serviceLock
            .getCharacteristic(this.api.hap.Characteristic.LockTargetState)
            .updateValue(state ? 0 : 1);
            
          serviceLock
            .getCharacteristic(this.api.hap.Characteristic.LockCurrentState)
            .updateValue(state ? 0 : 1);
          
        }, 500);
        
        callback();
      
      });
    
    serviceLock
      .getCharacteristic(this.api.hap.Characteristic.LockCurrentState)
      .on('change', state => {
        if(state.oldValue !== state.newValue)
          Logger.info('Car trunk lock ' + (state.newValue ? 'secured' : 'unsecured'), this.accessory.displayName);
      });
      
    //Battery
  
    if (!serviceBattery) {
      Logger.info('Adding Battery service', this.accessory.displayName);
      serviceBattery = this.accessory.addService(this.api.hap.Service.BatteryService);
    }
    
    //Doors
    
    if (!serviceDoor) {
      Logger.info('Adding ContactSensor (doors) service', this.accessory.displayName);
      serviceDoor = this.accessory.addService(this.api.hap.Service.ContactSensor, 'Doors', 'door');
    }
    
    serviceDoor
      .getCharacteristic(this.api.hap.Characteristic.ContactSensorState)
      .on('change', state => {
        if(state.oldValue !== state.newValue)
          Logger.info('Door(s)/Car trunk ' + (state.newValue ? 'opened' : 'closed'), this.accessory.displayName);
      });
    
    //Windows
    
    if (!serviceWindow) {
      Logger.info('Adding ContactSensor (windows) service', this.accessory.displayName);
      serviceWindow = this.accessory.addService(this.api.hap.Service.ContactSensor, 'Windows', 'window');
    }
    
    serviceWindow
      .getCharacteristic(this.api.hap.Characteristic.ContactSensorState)
      .on('change', state => {
        if(state.oldValue !== state.newValue)
          Logger.info('Window(s)/Sunroof ' + (state.newValue ? 'opened' : 'closed'), this.accessory.displayName);
      });
    
    //Lights
    
    if (!serviceLight) {
      Logger.info('Adding LightBulb service', this.accessory.displayName);
      serviceLight = this.accessory.addService(this.api.hap.Service.Lightbulb, 'Lights', 'lightbulb');
    }
  
    serviceLight
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on('change', state => {
        if(state.oldValue !== state.newValue)
          Logger.info('Front/Rear light ' + (state.newValue ? 'on' : 'off'), this.accessory.displayName);
      })
      .on('set', (state, callback) => {
      
        Logger.info('Can not change light state. Not supported at the moment!', this.accessory.displayName);
            
        setTimeout(() =>{
          
          serviceLight
            .getCharacteristic(this.api.hap.Characteristic.On)
            .updateValue(state ? false : true);
          
        }, 500);
        
        callback();
      
      });

    this.getStates(serviceLock, serviceBattery, serviceDoor, serviceWindow, serviceLight);
    
  }

  async getStates(serviceLock, serviceBattery, serviceDoor, serviceWindow, serviceLight){
    
    try {

      if(!this.accessory.context.config.electricVehicle){
      
        let dataFuel = await this.me.fuelStatus(this.accessory.context.config.vin);
        Logger.debug(dataFuel, this.accessory.displayName);
        
        await this.handleBatteryFuel(dataFuel, serviceBattery);
      
      } else {
        
        let dataElectro = await this.me.electroStatus(this.accessory.context.config.vin);
        Logger.debug(dataElectro, this.accessory.displayName);
        
        await this.handleBatteryElectro(dataElectro, serviceBattery);
        
      }
      
      let dataLock = await this.me.lockStatus(this.accessory.context.config.vin);
      Logger.debug(dataLock, this.accessory.displayName);
      
      await this.handleLock(dataLock, serviceLock);
      
      let dataVehicle = await this.me.vehicleStatus(this.accessory.context.config.vin);
      Logger.debug(dataVehicle, this.accessory.displayName);
      
      await this.handleDoors(dataVehicle, serviceDoor);
      await this.handleWindows(dataVehicle, serviceWindow);
      await this.handleLights(dataVehicle, serviceLight);
      
      /*let dataPayDrive = await this.me.payDrive(this.accessory.context.config.vin);
      Logger.debug(dataPayDrive);*/
      
    } catch(err) {
      
      let error;
      
      Logger.error('An error occured during polling API', this.accessory.displayName);
      
      if(err.response){
        if(err.response.status === 401 || err.response.status === 403){
          error = 'It seems that it is not possible anymore to grant access with your stored token!';
        } else if(err.response.status === 404){
          error = 'Your car does not support this!';
        } else if(err.response.status === 429 || err.response.status === 500){
          error = 'Received too many requests!';
        } else if(err.response.status === 503 || err.response.status == 504){
          error = 'Mercedes API currently not available!';
        } else if(err.response.data){
          error = err.response.data;
        }
      }
      
      if(err.output)
        error = err.output.payload || err.output;
    
      error = error || err;
      
      Logger.error(error);
      
    } finally {
      
      setTimeout( () => {
        this.getStates(serviceLock, serviceBattery, serviceDoor, serviceWindow, serviceLight);
      }, this.accessory.context.config.polling);
      
    }
    
  }
  
  async handleBatteryFuel(dataFuel, service){
    
    let batteryValue;
    let batteryState = 0;
    
    if(dataFuel.length){
      
      for(const key in dataFuel){
          
        //tank fuel as battery
    
        if(dataFuel[key].tanklevelpercent){
          
          batteryValue = parseInt(dataFuel[key].tanklevelpercent.value);
          
        } else if(dataFuel[key].rangeliquid && this.accessory.context.config.maxRange) {
          
          batteryValue = (100/this.accessory.context.config.maxRange) * parseInt(dataFuel[key].rangeliquid.value);
          
        }
        
      }
      
    }
    
    if(batteryValue !== undefined){
      
      if(batteryValue <= 20)
        batteryState = 1;
        
      service
        .getCharacteristic(this.api.hap.Characteristic.BatteryLevel)
        .updateValue(batteryValue);
        
    }
    
    service
      .getCharacteristic(this.api.hap.Characteristic.ChargingState)
      .updateValue(0);
      
    service
      .getCharacteristic(this.api.hap.Characteristic.StatusLowBattery)
      .updateValue(batteryState);
    
    return;
    
  }
  
  async handleBatteryElectro(dataElectro, service){
    
    let batteryValue;
    let batteryState = 0;
    
    if(dataElectro.length){
      
      for(const key in dataElectro){
          
        //electro battery
    
        if(dataElectro[key].soc){
          
          batteryValue = parseInt(dataElectro[key].soc.value);
          
        } else if(dataElectro[key].rangeelectric && this.accessory.context.config.maxRange) {
          
          batteryValue = (100/this.accessory.context.config.maxRange) * parseInt(dataElectro[key].rangeelectric.value);
          
        }
        
      }
      
    }
    
    if(batteryValue !== undefined){
      
      if(batteryValue <= 20)
        batteryState = 1;
        
      service
        .getCharacteristic(this.api.hap.Characteristic.BatteryLevel)
        .updateValue(batteryValue);
        
    }
    
    service
      .getCharacteristic(this.api.hap.Characteristic.ChargingState)
      .updateValue(0);
      
    service
      .getCharacteristic(this.api.hap.Characteristic.StatusLowBattery)
      .updateValue(batteryState);
    
    return;
    
  }

  async handleLock(dataLock, service){
    
    let lockValue = [];
    
    if(dataLock.length){
    
      for(const key in dataLock){
        
        if(dataLock[key].doorlockstatusdecklid && (dataLock[key].doorlockstatusdecklid.value === 'false')){
          
          lockValue.push(1);
          
        } else if(dataLock[key].doorlockstatusvehicle && (dataLock[key].doorlockstatusvehicle.value === '1' || dataLock[key].doorlockstatusvehicle.value === '2')){
          
          lockValue.push(1);
          
        } else if(dataLock[key].doorlockstatusgas && (dataLock[key].doorlockstatusgas.value === 'false')){
          
          lockValue.push(1);
          
        }
        
      }
      
    }
    
    let state = lockValue.includes(1) ? 1 : 0;
    
    service
      .getCharacteristic(this.api.hap.Characteristic.LockCurrentState)
      .updateValue(state);
      
    service
      .getCharacteristic(this.api.hap.Characteristic.LockTargetState)
      .updateValue(state);
      
    return;
  
  }
  
  async handleDoors(dataVehicle, service){
    
    let doorValue = [];
    
    if(dataVehicle.length){
    
      for(const key in dataVehicle){
        
        //door
        
        if(dataVehicle[key].doorstatusfrontleft && (dataVehicle[key].doorstatusfrontleft.value === 'true')){
        
          doorValue.push(1);
          
        } else if(dataVehicle[key].doorstatusfrontright && (dataVehicle[key].doorstatusfrontright.value === 'true')){
          
          doorValue.push(1);
          
        } else if(dataVehicle[key].doorstatusrearleft && (dataVehicle[key].doorstatusrearleft.value === 'true')){
          
          doorValue.push(1);
          
        } else if(dataVehicle[key].doorstatusrearright && (dataVehicle[key].doorstatusrearright.value === 'true')){
          
          doorValue.push(1);
          
        } else if(dataVehicle[key].decklidstatus && (dataVehicle[key].decklidstatus.value === 'true')){
          
          doorValue.push(1);
          
        }
        
      }
      
    }
    
    let state = doorValue.includes(1) ? 1 : 0;
    
    service
      .getCharacteristic(this.api.hap.Characteristic.ContactSensorState)
      .updateValue(state);
      
    return;
  
  }
  
  async handleWindows(dataVehicle, service){
    
    let windowValue = [];
    
    if(dataVehicle.length){
    
      for(const key in dataVehicle){
        
        //window
        
        if(dataVehicle[key].windowstatusfrontleft && (dataVehicle[key].windowstatusfrontleft.value === '1')){
        
          windowValue.push(1);
          
        } else if(dataVehicle[key].windowstatusfrontright && (dataVehicle[key].windowstatusfrontright.value === '1')){
          
          windowValue.push(1);
          
        } else if(dataVehicle[key].windowstatusrearleft && (dataVehicle[key].windowstatusrearleft.value === '1')){
          
          windowValue.push(1);
          
        } else if(dataVehicle[key].windowstatusrearright && (dataVehicle[key].windowstatusrearright.value === '1')){
          
          windowValue.push(1);
          
        } else if(dataVehicle[key].sunroofstatus && (dataVehicle[key].sunroofstatus.value !== '0')){
          
          windowValue.push(1);
          
        }
        
      }
      
    }
    
    let state = windowValue.includes(1) ? 1 : 0;
      
    service
      .getCharacteristic(this.api.hap.Characteristic.ContactSensorState)
      .updateValue(state);
      
    return;
    
  }
  
  async handleLights(dataVehicle, service){
    
    let lightValue = [];
    
    if(dataVehicle.length){
    
      for(const key in dataVehicle){
        
        //lightbulb
      
        if(dataVehicle[key].interiorLightsFront && (dataVehicle[key].interiorLightsFront.value === 'true')){
          
          lightValue.push(1);
          
        } else if(dataVehicle[key].interiorLightsRear && (dataVehicle[key].interiorLightsRear.value === 'true')){
          
          lightValue.push(1);
          
        } else if(dataVehicle[key].readingLampFrontLeft && (dataVehicle[key].readingLampFrontLeft.value === 'true')){
          
          lightValue.push(1);
          
        } else if(dataVehicle[key].readingLampFrontRight && (dataVehicle[key].readingLampFrontRight.value === 'true')){
          
          lightValue.push(1);
          
        }
        
      }
      
    }
    
    let state = lightValue.includes(1) ? true : false;
      
    service
      .getCharacteristic(this.api.hap.Characteristic.On)
      .updateValue(state);
      
    return;
    
  }

}

module.exports = CarAccessory;