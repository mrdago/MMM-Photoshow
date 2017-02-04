/* Magic Mirror
 * Module: MMM-Photoshow
 *
 * By Mr.Sponti
 *      
 * MIT Licensed.
 */

var NodeHelper = require('node_helper');
var fs = require('fs');
var path = require('path');
var piexif = require("piexifjs");

module.exports = NodeHelper.create({
	start: function () {
        console.log('MMM-Photoshow helper started...');
	},

    // Recurse into a directory, executing callback for each file.
    readAlbumItems: function (rootdir, callback, subdir) {
        var self = this;
        var abspath = subdir ? path.join(rootdir, subdir) : rootdir;
        fs.readdirSync(abspath).forEach(function(filename) {
            var filepath = path.join(abspath, filename);
            if (fs.statSync(filepath).isDirectory()) {
                self.readAlbumItems(rootdir, callback, path.join(subdir || '', filename || ''));
            } else {
                callback(filepath, rootdir, subdir, filename);
            }
        });
    },
    
    // Read directories and extract exif data
    loadPhotoAlbum: function() {
        var self = this;     
        
        var photoDir = '/pictures';
        var albumDir = this.path + '/public' + photoDir;
        var album = {};     
        var dateTaken = '-';
 
        self.readAlbumItems(albumDir, function(filepath, rootdir, subdir, filename) { 
            if (typeof album[subdir] === "undefined") {
               album[subdir] = [];
            }
            album[subdir].push({'file': filepath, 'photolink': '/'+self.name+photoDir+'/'+subdir+'/'+filename, 'dateTaken': dateTaken});
        });
        //console.log(album);
        self.sendSocketNotification('PHOTO_ALBUM_FILLED', album);
     },
    
    // read time stamp 'dateTimeOriginal' from image file
    readExifData: function(image) {
        var self = this;     
        var image = image;                                  // file path to image
        var dateTaken = '';                                 // default value in case there is no time stamp
        
        const DateTimeOriginal = 36867;                     // for details consult "piexifjs" docu and test script  
        var data = fs.readFileSync(image);
        var jpeg = data.toString("binary");
        var exifObj = piexif.load(jpeg);
        var dateTime = exifObj.Exif[DateTimeOriginal];      // yyyy:mm:dd hh:mm
        //console.log('  dateTime: ' + dateTime);
        if( typeof dateTime !== 'undefined') {
            if ( dateTime.substring(0,4) !== "0000" ) {
                dateTaken = 'Aufgenommen am: ' + dateTime.substring(8,10) + '.' + dateTime.substring(5,7) + '.' + dateTime.substring(0,4);
            }
            //console.log(image + '  dateTaken: ' + dateTaken);
            self.sendSocketNotification('PHOTO_EXIF_FILLED', dateTaken);
        }
    },
    
    // read directory and create list of photo files 
	socketNotificationReceived: function (notification, payload) {
        if (notification == 'PHOTO_ALBUM_LOAD') {
            this.loadPhotoAlbum();
		}
        if (notification == 'PHOTO_LOAD_EXIF') {
            this.readExifData(payload);
		}
	},

})
