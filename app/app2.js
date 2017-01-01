var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

app.get('/api/logs', getLogs);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


var serialPortName = '/dev/ttyAMA0';
var SerialPort = require('serialport').SerialPort;
var serial = new SerialPort(serialPortName, { baudrate: 9600 });
var serialPortAvailable = false;

function startSerialPort() {
    serial.on('open', function() {	
	serialPortAvailable = true;
	consolelog('Serial port avail');
    });

    serial.on('close', function() {
	serialPortAvailable = false;
	consolelog('Serial port closed');
    });

    serial.on('error', function(error) {
	serialPortAvailable = false;
	consoleerr('Serial port error:');
	consoleerr(error);
    });
}

startSerialPort();

var logs = [];

function getLogs(req, res) {
    res.send(logs);
}

function doLog(log, prefix) {
    logs.push(log);
    console.log(prefix + ' ' + log);
}

function serlog(log) {
    if (serialPortAvailable) {
        serial.write(log);
        serial.write('\n');
    }
}

function consolelog(log) {
    doLog(log, '>');
}

function consoleerr(log) {
    doLog(log, '!');
}

var fs = require('fs');

// Environment variable for flickr settings
var flickrOptions = {
    api_key: process.env.FLICKR_API_KEY,
    secret: process.env.FLICKR_API_SECRET,
    user_id: process.env.FLICKR_USER_ID,
    access_token: process.env.FLICKR_ACCESS_TOKEN,
    access_token_secret: process.env.FLICKR_ACCESS_TOKEN_SECRET,
    nobrowser: true
};

// Alternatively, create the above json object in the file below
// See README.md
// var flickrOptions = require('./flickr_auth.json');

consolelog('Flickr setting:');
consolelog(flickrOptions);

var Flickr = require("flickrapi");

// used for requesting images from flickr
request = require('request');

var downloadImages = true;
var downloadedImagesRootDir = 'downloadedImages';

function getPhotoSetDownloadDir(lphotoSetName) {
    return path.join(downloadedImagesRootDir, lphotoSetName);
}

function downloadImage(uri, filename, downloadDir, callback) {
    var p = path.join(downloadDir, filename);

    if (fs.existsSync(p)) {
	consolelog('Image ' + filename + ' exists');
        callback(null, p);
        return;
    }

    if (!downloadImages) {
	callback(new Error('Downloading disabled. ' + filename + ' does not exist', null));
	return;
    }

    // download the image
    request.head(uri, function (err, res, body) {
	if (err) {
	    serlog('Img down ERR');
	    consoleerr('Could not download ' + filename + ':');
	    callback(err, null);
	    return;
	}
	
	// download the image
	var r = request(uri).pipe(fs.createWriteStream(p));
	r.on('close', function () { 
	    callback(null, p); 
	});
    });
}

var displayHeightPixels = 1024;

function getSinglePhoto(lflickr, photo, downloadDir, callback) {
    var id = photo.id;
    var title = photo.title;
    var filename = title + ".jpg";
    lflickr.photos.getSizes({
        photo_id: id,
        authenticated: true,
    }, function (err, result) {
        if (err) {
	    serlog('Flickr size ERR');
            consoleerr('Couldn\'t get sizes for ' + filename + ':');
	    consoleerr(err);
            callback(err, null);
	    return;
        }

        var found = false;
        for (var i in result.sizes.size) {
            if (found) {
                break;
            }
		
            var size = result.sizes.size[i];
            if (size.height < displayHeightPixels) {
                continue;
            }
                
            found = true;
            var source = size.source;
            downloadImage(source, filename, downloadDir, function (err, downloadedImagePath) {
		if (err) {
		    consoleerr('Couldn\'t download ' + filename + ':');
		    consoleerr(err);
		    callback(err, null);
		    return;
		}

                callback(null, downloadedImagePath);
            });
        }

        if (!found) {
            callback(new Error("Couldn't find " + displayHeightPixels + " height for " + title), null);
        }
    });
}

var photoSetPhotos = [];
var nextPhotoIndex = -1;


function getPhotoSetPhotos(lflickrOptions, lflickr, photoSet, callback) {
    var id = photoSet.id;
    var title = photoSet.title._content;
    var numPhotos = photoSet.photos
    
    if (numPhotos < 1) {
	photosetPhotos = [];
        callback(new Error(title + ' is empty', null));
        return;
    }

    // create the downloadedImagesRootDir if not existing
    if (!fs.existsSync(downloadedImagesRootDir)) {
        consolelog("Creating global download folder " + downloadedImagesRootDir);
        fs.mkdirSync(downloadedImagesRootDir);
    }

    serlog(title + ': ' + numPhotos);
    consolelog(title + ' has ' + numPhotos + ' imgs');

    lflickr.photosets.getPhotos({
        photoset_id: id,
        user_id: lflickrOptions.user_id,
        authenticated: true,
    }, function (err, result) {
        if (err) {
	    serlog('No imgs');
            consoleerr("Could not get images for " + title + ":");
	    consoleerr(err);
            callback(err);
        } else {
            var title = result.photoset.title;
            var numPhotos = result.photoset.total;
	    if (result.photoset.photo.length != photoSetPhotos.length) {
		nextPhotoIndex = result.photoset.photo.length - 1;
	    }
            photoSetPhotos = result.photoset.photo;
	    consolelog('Got ' + photoSetPhotos.length + ' images. Next index ' + nextPhotoIndex + ".");
	    callback(null);
        }
    });
}

var isDownloadingNextImage = false;
function downloadAndShowNextImage(lfimClient, lflickrOptions, lflickr, lphotoSetName) {

    consolelog('Down+disp img in ' + lphotoSetName + '.');
    if (photoSetPhotos.length == 0) {
	consolelog('No imgs to show');	
	return;
    }

    if (inRefreshPhotoSetPhotos) {
	consolelog('Album refreshing. Skip');
	return;
    }

    if (isDownloadingNextImage) {
        return;
    }
    isDownloadingNextImage = true;

    if (nextPhotoIndex < 0 || nextPhotoIndex >= photoSetPhotos.length) {	
	nextPhotoIndex = photoSetPhotos.length - 1;
    }

    if (nextPhotoIndex < 0) {
	consolelog('Next img index -1. Skip');
	isDownloadingNextImage = false;
	return;
    }

    serlog('Img ' + nextPhotoIndex);
    consolelog('Img index ' + nextPhotoIndex);
    
    var photo = photoSetPhotos[nextPhotoIndex];
    var downloadDir = getPhotoSetDownloadDir(lphotoSetName);

    getSinglePhoto(lflickr, photo, downloadDir, function(err, downloadedImagePath) {
	nextPhotoIndex--;
	isDownloadingNextImage = false;

	if (err) {	   
	    consoleerr('Could not get image:')
	    consoleerr(err);
	    return;
	}

	consolelog('Show next img');
	fimShowImage(lfimClient, downloadedImagePath);
    });
}

function findPhotoframeSet(photosetArray, lphotoSetName) {
    var num = photosetArray.length;
    if (num == 0) {
	consolelog('No albums found');
	return null;
    }

    for(var i in photosetArray) {
	var photoSet = photosetArray[i];

	if (photoSet.title._content == lphotoSetName) {
	    return photoSet;
	}
    }

    return null;
}

var imageDelayInMinutes = 1;
var downloadAndShowNextImageIntervalObject = null;
function startShowingImages(lfimClient, lflickrOptions, lflickr, lphotoSetName) {
    serlog(lphotoSetName);
    consolelog('Showing ' + lphotoSetName + ' imgs');

    // clear the previous interval refresh
    if (downloadAndShowNextImageIntervalObject != null) {
	clearInterval(downloadAndShowNextImageIntervalObject);
	downloadAndShowNextImageIntervalObject = null;
    }

    // show next image
    downloadAndShowNextImage(lfimClient, lflickrOptions, lflickr, lphotoSetName);
    // show next image after some delay
    downloadAndShowNextImageIntervalObject = setInterval(function () {
	downloadAndShowNextImage(lfimClient, lflickrOptions, lflickr, lphotoSetName);
    }, imageDelayInMinutes * 60 * 1000);
}


var inRefreshPhotoSetPhotos = false;

function refreshPhotoSetPhotos(lfimClient, lflickrOptions, lphotoSetName) {
    if (isDownloadingNextImage) {
	consolelog('Downloading img. Skip');
	return;
    }

    if (inRefreshPhotoSetPhotos) {
	consolelog('Refreshing album. Skip');
	return;
    }

    inRefreshPhotoSetPhotos = true;
    serlog('Reload imgs');
    consolelog('Refreshing album ' + lphotoSetName);

    Flickr.authenticate(lflickrOptions, function (error, flickr) {
        if (error) {
	    serlog('Flickr ERR');
            consoleerr('Flickr auth. error:');
	    consoleerr(error);
	    inRefreshPhotoSetPhotos = false;
	    return;
        }

	serlog('Flickr OK');
        consolelog("Flickr auth. success");

        flickr.photosets.getList({
            user_id: flickrOptions.user_id,
            authenticated: true,
        }, function (err, result) {
	    if (err) {
		serlog('Album ERR');
		consoleerr('Error getting photo albums:');
		consoleerr(err);
		inRefreshPhotoSetPhotos = false;
		return;
	    }

            if (result.photosets.total < 1) {
		serlog('No albums');
                consolelog('No albums');
		inRefreshPhotoSetPhotos = false;
		return;
            }

            var photoframeSet = findPhotoframeSet(result.photosets.photoset, lphotoSetName);
            if (photoframeSet == null) {
		serlog('No ' +  lphotoSetName);
                consolelog('No album named ' + lphotoSetName);
		inRefreshPhotoSetPhotos = false;
		return;
            }
            
	    getPhotoSetPhotos(lflickrOptions, flickr, photoframeSet, function (err, result) {
		inRefreshPhotoSetPhotos = false;
                if (err) {
                    consoleerr('Error listing album imgs:');
		    consoleerr(err);		    
		    return;
                } 

		consolelog('Got list of album imgs.');
		startShowingImages(lfimClient, lflickrOptions, flickr, lphotoSetName);                
            });
        });
    });
}

var net = require('net');
var fimClient = new net.Socket();
var fimConnected = false;
var tryFailCount = 0;

// connects to fim via TCP
var fimPort = 4000;
var fimHost = 'localhost';

function connectToFim(lclient) {
    if (fimConnected) {
	consolelog('Connected to fim. Skip');
	return;
    }

    consolelog('Connecting to fim ' + fimHost + ':' + fimPort);
    lclient.connect(fimPort, fimHost);
}

fimClient.on('connect', function () {
    //consolelog('Fim ' + fimClient.remoteAddress + ':' + fimClient.remotePort);
    fimConnected = true;
    tryFailCount = 0;
});

fimClient.on('close', function (had_error) {
    fimConnected = false;
    consolelog('Fim client closed');
    setTimeout(function() { connectToFim(fimClient); }, 3000);
});

var fimFailReconnectDelayInSeconds = 5;

fimClient.on('error', function (error) {
    fimConnected = false;
    serlog('Fim ERR');
    consoleerr('Fim client error: ');
    consoleerr(error);
    fimClient.destroy();
    tryFailCount++;
    if (tryFailCount <= 100) {
	serlog('Fim ERR');
	consolelog("Connecting to fim " + tryFailCount + "/100");
	setTimeout(function() { connectToFim(fimClient); }, fimFailReconnectDelayInSeconds * 1000);
    } else {
        consolelog("Giving up fim");
    }
});

function fimShowImage(lclient, image) {
    // not connected yet, wait
    if (!fimConnected) {
       consolelog("Not connected to fim. Skip");
       return;
    }

    // connect to fim and show image
    serlog('Img -> fim');
    consolelog(image + ' on fim.');
    var command = "pop;push '" + image + "';next;"
    lclient.write(command, function () { 
	//consolelog('Fim command: ' + command); 
    });
    lclient.destroy();
    // assume we've disconnected from fim
    fimConnected = false;
}

// connect to fim
connectToFim(fimClient);


var photoframeSetName = 'photoframe';
var refreshPhotoSetPhotosDelayInSeconds = 90;

function startRefreshPhotoSetPhotos(lfimClient, lflickrOptions, lphotoSetName) {
    refreshPhotoSetPhotos(lfimClient, lflickrOptions, lphotoSetName);
    setInterval(function() {
	refreshPhotoSetPhotos(lfimClient, lflickrOptions, lphotoSetName)
    }, refreshPhotoSetPhotosDelayInSeconds * 1000);
}

startRefreshPhotoSetPhotos(fimClient, flickrOptions, photoframeSetName);

serlog('GPIO');
consolelog('Preparing GPIO pins');
var Gpio = require('onoff').Gpio;
var pir = new Gpio(5, 'in', 'both');
var ard = new Gpio(6, 'out');

var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var _ = require('underscore');

// always assume it's off
var monitorState = 'off';

function getMonitorStatus(callback) {
    var state = 'off';

    // spawn child process
    var s = spawn('tvservice', ['-s'], {
        cwd: process.PWD,
        env: _.extend(process.env, { PATH: process.env.PATH + ':/usr/local/bin'})
    });

    // display stdout
    s.stdout.on('data', function(data) {
	if (data.toString('ascii').indexOf('off') > -1) {
	    state = 'off';
	} else {
	    state = 'on';
	}
    });

    // child process is done
    s.on('close', function(code) {
        if (code == 0) {
	    callback(null, state);
        } else {
	    callback(new Error('Error getting disp. state (' + code + ')'), state);
	}
    });
}

// toggle monitor on or off if it's
// not already in given state
function toggleMonitor(state, callback) {
    if (monitorState == state) {
	serlog('Disp. ' + state);
	consolelog('Display is  ' + state);
	if (callback) { callback(null, state); }
	return;
    }

    consolelog('Set display ' + state);

    // spawn child process
    var s = spawn('sh', ['toggleMonitor.sh', state ], {
	cwd: process.PWD,
	env: _.extend(process.env, { PATH: process.env.PATH + ':/usr/local/bin' })
    });

    // display stdout
    s.stdout.on('data', function(data) {
        //consolelog('Toggle display: ' + data);
    });

    // child process is done
    s.on('close', function(code) {
	if (code == 0) {
	    monitorState = state;
	}
	serlog('Disp. ' + monitorState);
	consolelog('Display is ' + monitorState + ' (' + code + ')');
	if (callback) {
	    callback(null, monitorState);
	}
    });
}

// turn monitor off
function offMonitor(callback) {
    toggleMonitor('off', callback);
}

// turn monitor on
function onMonitor(callback) {
    toggleMonitor('on', callback);
}

// clear any existing timeouts
// set to timeout after
var monitorTimeoutDelayInMinutes = 5;
// needed to clear any existing timeouts
var monitorTimeoutId = null;
function setMonitorTimeout() {
    if (monitorTimeoutId != null) {
        clearTimeout(monitorTimeoutId);
	monitorTimeoutId = null;
    }

    // turn off monitor after specified minutes
    serlog('Disp. off trig.');
    consolelog('Display off in ' + monitorTimeoutDelayInMinutes + 'm');
    var m = monitorTimeoutDelayInMinutes * 60 * 1000;
    monitorTimeoutId = setTimeout(offMonitor, m);
}

// clear the monitor off trigger timeout
function clearMonitorTimeout() {
    serlog('Clear disp. off');
    consolelog('Clear display off');
    if (monitorTimeoutId != null) {
        clearTimeout(monitorTimeoutId);
	monitorTimeoutId = null;
    }
}

// watch for interruptss on PIR pin
pir.watch(function(err, value) {
    ard.writeSync(value);

    // motion is deteced. Turn on monitor and don't
    // turn it off unless there is no motion
    if (value == 1) {
	onMonitor();
	clearMonitorTimeout();
    } else {
	// no motion, set the monitor to turn off
	setMonitorTimeout();
    }
});

// Turn on monitor if it's off
function startDisplay() {
    getMonitorStatus(function(err, state) {
	if (err) {
	    serlog('Disp. ERR');
	    consoleerr('Error display:');
	    consoleerr(err);
	} else {
	    consolelog('Display is ' + state);
	    monitorState = state;
	}
	
	offMonitor(function(err, result) {
	    // turn monitor back on after 2s
	    setTimeout(onMonitor, 2000);
	});
    });
}

// not used currently
function startFimServer() {
    consolelog('Start fim srv');

    // spawn child process
    var s = spawn('sh', ['fim-nc.sh'], {
        cwd: process.PWD,
        env: _.extend(process.env, { PATH: process.env.PATH + ':/usr/local/bin' })
    });

    // display stdout
    s.stdout.on('data', function(data) {
        consolelog('Fim srv: ' + data);
    });

    // child process is done
    s.on('close', function(code) {
        consolelog('Fim srv closed (' + code + ')');
    });
}

startDisplay();


// turn off if no monition
setMonitorTimeout();

// on exit, unexport the pir and Arduino pins
function exitApp() {
    serlog('GPIO off');
    consolelog("Disconnecting GPIO pins");
    pir.unexport();
    ard.unexport();
    process.exit();
}

process.on('SIGINT', exitApp);

module.exports = app;
