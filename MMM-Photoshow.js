/* global Module */

/* Magic Mirror
 * Module: MMM-Photoshow
 *
 * Created:     12.01.2017      by:  Mr.Sponti
 * Last edit:   29.01.2017
 *
 * MIT Licensed.
 */
 
Module.register('MMM-Photoshow', {
    
    defaults: { 
        animationSpeed: 1000,       // 1 second
        updateInterval: 600000,     // 10 minutes
    },
     
    getStyles: function() {
        return ['photoshow.css'];
    },

	getScripts: function() {
		return [ this.file('node_modules/jquery/dist/jquery.min.js')];
	},
    
    // Define start sequence
    start: function() {
        Log.info('Starting module: ' + this.name);
        this.loaded = false;
        this.photos = {};
        this.album  = {};
        this.album.activeItem = 0;
        this.album.lastItem   = 1;
        this.album.activeMode = 'Nacheinander';
        this.album.activeAlbum = 'none';
        this.album.animationSpeed = this.config.animationSpeed;
        this.imageMessage = "";                         // holds the last incomming control request
        this.updateIntervalId = 0;                      // display update interval for new photo
    },
    
    // notifications from other modules 
    notificationReceived: function (notification, payload) {
        if(notification === 'NSH_LISTNER_ACTIVE') {            // received from core modul
            this.sendSocketNotification('PHOTO_ALBUM_LOAD');
        } else if(notification === 'NSH_REQUEST') {                         
            this.incomingRequest(payload);                      // received from network via modul (==> MMM-M1-Pimatic)
        }         
    },
    
    // notifications from node helper  --> all photos loaded
	socketNotificationReceived: function (notification, payload) {   
        //Log.info(notification);
        if ( notification === 'PHOTO_ALBUM_FILLED' ) {
            this.photos = payload;
            this.imageMessage = notification;
            this.incomingRequest(this.imageMessage);
            if(!this.loaded) {                      
                this.loaded = true;
                this.hide();
            }
        }
        if ( notification === 'PHOTO_EXIF_FILLED' ) {
           this.photos[this.album.activeAlbum][this.album.activeItem].dateTaken = payload;
           this.loadImage();
        }
	},
    
    // Override the dom generator
 	getDom: function() {
		var wrapper = document.createElement('div');
		
		if (!this.loaded) {
            wrapper.className = 'status';
            wrapper.innerHTML = "Loading pictures ...";
            return wrapper;
        }		

        var backgroundImage = document.createElement('div');
		backgroundImage.className = 'background-image fullscreen';
		
		var backgroundPlaceholder1 = document.createElement('div');
		backgroundPlaceholder1.id = 'background-placeholder-1';
		backgroundPlaceholder1.className = 'fullscreen';
		
		var backgroundPlaceholder2 = document.createElement('div');
		backgroundPlaceholder2.id = 'background-placeholder-2';
		backgroundPlaceholder2.className = 'fullscreen';
		
		backgroundImage.appendChild(backgroundPlaceholder1);
		backgroundImage.appendChild(backgroundPlaceholder2);

		wrapper.appendChild(backgroundImage);
		
		var imageInfo = document.createElement('div');
		imageInfo.className = 'image-info-line';
		
		var imageMessage = document.createElement('div');
		imageMessage.className = 'image-message';
		imageMessage.id = 'image-message';
        
		var imageDetails = document.createElement('div');
		imageDetails.className = 'image-details';
		imageDetails.id = 'image-details';
		
		imageInfo.appendChild(imageMessage);
		imageInfo.appendChild(imageDetails);
		
        wrapper.appendChild(imageInfo);
		
		return wrapper;
	},   
    
    // photo show is controlled from another modul (i.e. mmSpeech module, infrared or whatever)
    incomingRequest: function(request) {
        var self = this;  
        
        //Log.info(request);
        self.imageMessage = ">" + request + "<";
        
        switch(request) {
        case 'INFO_BOARD':
            if(self.updateIntervalId > 0){                                  // stop running photshow
                clearInterval(self.updateIntervalId);
                self.updateIntervalId = 0;
            }
            this.hide(1000);                                                // hide and suspend yourself  
            MM.getModules().exceptModule(this).enumerate(function(module) {
                module.show(1000);                                          // show all other MM modules
            });
            break;
        case 'Zufall':                                                      // switch to random mode
            if(self.updateIntervalId != 0){
                self.album.activeMode = 'Zufall';
                self.updateIntervalId = self.scheduleUpdateInterval();
            }
            break;
        case 'Nacheinander':                                                // switch to sequential mode
            if(self.updateIntervalId != 0){
                self.album.activeMode = 'Nacheinander';                     ;
                self.updateIntervalId = self.scheduleUpdateInterval();
            }
            break;
        case 'Stop':                                                        // stop running photo show
            if(self.updateIntervalId != 0){
                clearInterval(self.updateIntervalId);
                self.updateIntervalId = -1;
            }
            break;
        case 'Weiter':                                                      // step forward
            if(self.updateIntervalId != 0){
                self.album.activeItem+=1;
                if(self.album.activeItem > self.album.lastItem){
                    self.album.activeItem = 0;
                }
                self.updateIntervalId = self.scheduleUpdateInterval();
            }
            break;
        case 'Zurueck':                                                     // step backward
            if(self.updateIntervalId != 0){
                self.album.activeItem = self.album.activeItem - 1
                if(self.album.activeItem < 0 ){
                    self.album.activeItem = 0;
                }
                self.updateIntervalId = self.scheduleUpdateInterval(); 
            }
            break;  
        case 'Anfang':                                                      // step to the beginning
            if(self.updateIntervalId != 0){
                self.album.activeItem = 0;
                self.updateIntervalId = self.scheduleUpdateInterval();                 
            }
            break;  
        case 'LOAD_PICTURE':                                                // reload updated albums
            self.sendSocketNotification('PHOTO_ALBUM_LOAD');
            break;             
        case 'PHOTO_ALBUM_FILLED':                                                // reload updated albums
            Log.info('PHOTO_ALBUM_FILLED');
            break;           
        default:
             // select or switch to a photo album                       
            if(request != self.album.activeAlbum) {                         // 'Urlaub', 'Wohnen', ...
                self.album.activeAlbum = request;           
                self.album.activeItem = 0;
                self.album.lastItem = self.photos[self.album.activeAlbum].length-1
            }
            
            if(self.hidden) {                                               // hide all modules and show up
                // hide all other MM modules             
                MM.getModules().exceptModule(this).enumerate(function(module) {
                    module.hide(1000);
                });
                // show up
                this.show(1000);
            }
            self.updateIntervalId = self.scheduleUpdateInterval();      // start photo display intervall
        }
        
        // show updated info line
        if(self.album.activeAlbum !== 'none'){ 
            self.album.animationSpeed = 1;
            self.updateDom();
            self.loadImage();
        }
    },
    
    //
    // load image
    // image:       this.photos[this.album.activeAlbum][this.album.activeItem].photolink
    // dateTaken    this.photos[this.album.activeAlbum][this.album.activeItem].dateTaken
	//
    loadImage: function() {
		var self = this;
        
        // get time stamp 'dateTimeOriginal' from image file
        if(this.photos[this.album.activeAlbum][this.album.activeItem].dateTaken === '-'){
            this.sendSocketNotification('PHOTO_LOAD_EXIF', this.photos[this.album.activeAlbum][this.album.activeItem].file);
            return
        }   
        
        var image = this.photos[this.album.activeAlbum][this.album.activeItem]
        var imageDetails = image.dateTaken + '      ' + self.album.activeAlbum + '(' + (this.album.activeItem + 1) + '/' + (this.album.lastItem + 1) + ')';
        
        //Log.info('LoadImage: ' + image.photolink + imageDetails + self.album.animationSpeed + ':' + self.message);
          
        // Refactor this code
		var backgroundPlaceholder1 = $('#background-placeholder-1');
		var backgroundPlaceholder2 = $('#background-placeholder-2');
		
		if (backgroundPlaceholder1.is(':visible')) {
			var top = backgroundPlaceholder1;
			var bottom = backgroundPlaceholder2;
		} else {
			var top = backgroundPlaceholder2;
			var bottom = backgroundPlaceholder1;
		}

        $('<img/>').attr('src', image.photolink).load(function() {
			$('#background-placeholder-1').css({
					background: '#000 url("' + image.photolink + '") center center',
					backgroundSize: 'cover',
					backgroundRepeat: 'no-repeat'
				}).animate({
				opacity: 1.0
			}, self.album.animationSpeed, function() {
				$(this).attr('id', 'background-placeholder-2');
				$('#image-details').html(imageDetails);
                $('#image-message').html(self.imageMessage);
			});

			$('#background-placeholder-2').animate({
				opacity: 0
			}, self.album.animationSpeed, function() {
				$(this).attr('id', 'background-placeholder-1');
			});
		});
	},
    
    // schedule intervall for photo show
    scheduleUpdateInterval: function() {
        var self = this;
        
        // stop a running timer to restart a new one
        if (self.updateIntervalId > 0) {                  
            clearInterval(self.updateIntervalId);
        }

        // show a new photo after each updateIntervall is expired

        var updateIntervalId = setInterval(function() {
            var low = 0;
            var high = self.photos[self.album.activeAlbum].length-1
            
            if(self.album.activeMode === 'Zufall') {
                // generate random number as index for photo file array
                self.album.activeItem = Math.floor(Math.random() * (high - low + 1) + low); 
            }
            if(self.album.activeMode === 'Nacheinander') {
                // increase index to show next photo
                self.album.activeItem+=1;
                if(self.album.activeItem > high){
                    self.album.activeItem = low;
                }
            }
            self.imageMessage = "";
            self.album.animationSpeed = self.config.animationSpeed
            self.loadImage();
            
        }, this.config.updateInterval);
        
        return updateIntervalId;
    },
});
 

