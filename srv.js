var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var cookieParser = require('cookie-parser')
var url = require("url"),
path = require("path"),
fs = require("fs"),
mkdirp = require('mkdirp'),
request = require('request'),
port = process.env.port || 8080,
mysql = require('mysql'),
dateFormat = require('dateformat');
;

var serverAddress = "79.175.166.110:" + port;
//var serverAddress = "127.0.0.1:" + port;


var title = "پیشگامان آسیا";

var app = express();

app.use(express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/img'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(cookieParser());

var connection;

//mysql connection----------------------------------
function handleDisconnect() {
    connection = mysql.createConnection({
        host: "127.0.0.1",
        user: "root",
        password: "",
        database: 'car_gps',
    });


    connection.connect(function (err) {              // The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        } else {                                     // to avoid a hot loop, and to allow our node script to
            console.log("mysql connected");
        }
    });

    // process asynchronous requests in the meantime.
    // If you're also serving http, display a 503 error.
    connection.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            console.log("mysql reconnecting...");
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;
            console.log("EXCEPTION :: mysql connection ERROR");// server variable configures this)
        }
    });
}

handleDisconnect();

function insert(table, data, callback) {

    var query = connection.query("INSERT INTO " + table + " set ?;", data, function (err, rows) {

        console.log(query.sql);

        if (err) {
            console.log("Error inserting : %s", err);
            console.log(query.sql);

            callback(true);

            return;
        }

        if (callback) {
            callback(false);
        }

    });
}

function insertBulk(table, fields, data, callback) {

    var query = connection.query("INSERT INTO " + table + " (" + fields + ")  values ?;", [data], function (err, rows) {

        console.log(query.sql);

        if (err) {
            console.log("Error inserting : %s", err);
            console.log(query.sql);

            callback(true);

            return;
        }

        if (callback) {
            callback(false);
        }

    });
}

//------------------------------------------


function download(uri, filename, callback, callbackErr) {

    try {

        request.head(uri, function (err, res, body) {

            if (err) {
                callbackErr();
                return;
            }

            //console.log('content-type:', res.headers['content-type']);
            //console.log('content-length:', res.headers['content-length']);

            var r = request(uri).pipe(fs.createWriteStream(filename));
            r.on('close', callback);
        });

    } catch (e) {

        console.log('func download', e);
    }
};


//----------------------------------------------------


function sendFile(filename, res) {
    try {
        fs.readFile(filename, "binary", function (err, file) {

            if (err) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.write("404 Not Found\n");
                res.end();
                return;
            }

            res.writeHead(200);
            res.write(file, "binary");
            res.end();
        });
    } catch (e) {
        console.log("EXCEPTION  ::: sendFile", e);

        res.writeHead(500, { "Content-Type": "text/plain" });
        res.write("INTERNAL SERVER ERROR : 500");
        res.end();
    }
}



app.get('/', function httpReq(req, res) {

    res.render('pages/index.html', { serverAddress: serverAddress, title: title });
});

app.get('/*', function (req, res, next) {

    next();
});


app.get('/js/*', function (req, res) {

    var uri = url.parse(req.url).pathname
    var filename = path.join(__dirname + "/public", uri);

    sendFile(filename, res);
});

app.get('/img/*', function (req, res) {

    var uri = url.parse(req.url).pathname
    var filename = path.join(__dirname + "/public", uri);

    sendFile(filename, res);
});

app.get('/style/*', function (req, res) {

    var uri = url.parse(req.url).pathname
    var filename = path.join(__dirname + "/public", uri);

    sendFile(filename, res);
});


app.get('/tiles/[0-9]+/[0-9]+/[0-9]+\.png', function (req, res) {

    var uri = url.parse(req.url).pathname
      , filename = path.join(__dirname + "/public", uri);


    var urls = filename.split("\\");

    var imageUrl = "";

    for (var i = urls.length - 1; i > urls.length - 4 ; i--) {

        imageUrl = ("/" + urls[i]) + imageUrl;
    }

    imageUrl = "http://a.tile.openstreetmap.org" + imageUrl;


    var directory = "";

    for (var i = urls.length - 2; i > urls.length - 4 ; i--) {

        directory = ("/" + urls[i]) + directory;
    }

    directory = "public/tiles" + directory;


    mkdirp(directory, function (err) {
    });

    var tileName = directory + "/" + urls[urls.length - 1];

    fs.exists(tileName, function (exists) {
        if (!exists) {

            download(imageUrl, tileName, function () {

                sendFile(tileName, res);

            }, function () {

                res.writeHead(404, { "Content-Type": "text/plain" });
                res.write("404 Not Found\n");
                res.end();
                return;

            });
        } else {

            sendFile(tileName, res);
        }
    });
});

app.get('/getLocations', function (req, res) {

    try {
        var deviceId = JSON.parse(req.query.device_id) || req.query.device_id;
        var dateFrom = convertToMysqlDate(req.query.date_from) || "";
        var dateTo = convertToMysqlDate(req.query.date_to) || "";
    } catch (e) {
        console.log(e);

        var deviceId = req.query.device_id;
        var dateFrom = "";
        var dateTo =  "";
    }


    var query = connection.query("SELECT * FROM location, device " +
        "where location_device_id = device_id and location_device_id in (?) and " +
        "location_date > (?) and location_date < (?) ORDER BY location_device_id ASC",
        [deviceId,dateFrom,dateTo], function (err, rows) {


        console.log(query.sql);

        if (err) {

            console.log(err);

            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end();
            return;
        } else {

            var deviceLocs = {};
            var locs = [];

            for (var i = 0; i < rows.length; i++) {

                var row = rows[i];
                var deviceId = row.location_device_id;

                var device = deviceLocs[deviceId];

                var firstPoint;

                if (!device) {
                    device = [];

                    firstPoint = row;
                    device.push(firstPoint);

                    deviceLocs[deviceId] = device;
                    locs.push({ device_id: deviceId, device_name:row.device_name, locations: device });

                } else {


                    curPoint = row;

                    if (getDistance({ lat: firstPoint.location_lat, lon: firstPoint.location_lon }, { lat: curPoint.location_lat, lon: curPoint.location_lon }) * 1000 > 15) {

                        device.push(curPoint);
                    }

                    firstPoint = curPoint;

                }

            }

            res.send(locs);

        }


    });

});

app.get('/getDevices', function (req, res) {

    var str = req.query.query || "";



    var query = connection.query('SELECT * FROM device  where device_name LIKE "%' + str + '%" ;', function (err, rows) {


        if (err) {

            console.log(err);

            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end();
            return;
        } else {

            res.send(rows);

        }


    });


});

app.get('/sendTask', function (req, res) {


    var task1 = JSON.parse(req.query.task);
	var deviceId = task1.deviceId;
    var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    task = [
        0, //task_from_lat: 
        0, //task_from_lon: 
         task1.lat,//task_to_lat:
         task1.lon,//task_to_lon:
         now,
         task1.desc,//task_desc:
         deviceId//task_device_id:
    ];

    //var taskDb = JSON.stringify(task);

    sendTaskToSocket(deviceId, {
        fromLat: 0,
        fromLon: 0,
        toLat: task1.lat,
        toLon: task1.lon,
        date: now,
        description: task1.desc
    });

    insertBulk("task", "task_from_lat, task_from_lon, task_to_lat, task_to_lon, task_date, task_desc, task_device_id",
       [task], function (err) {

           if (err) {

               console.log("error bulk inserting");
               res.send({ result: 'error' });
               return;
           }

           console.log("bulk inserted");
           res.send({ result: 'ok' });
           return;

       });



   // console.log(task);

});

app.post('', function (req, res) {

    var tag = req.body.tag;

    console.log(req.body, tag);


    if (tag == "location") {

        var locations = JSON.parse(req.body.locations);

        console.log(locations.length);

        var locs = [];

        for (var i = 0; i < locations.length; i++) {

            var locs1 = [];

            locs1.push(locations[i].device_id);
            locs1.push(locations[i].lat);
            locs1.push(locations[i].lon);
            locs1.push(locations[i].date);
            locs1.push(locations[i].speed);

            console.log(locs1);

            locs.push(locs1);
        }


        console.log(locs);



        insertBulk("location", "location_device_id, location_lat, location_lon, location_date, location_speed",
        locs, function (err) {

            if (err) {

                console.log("error bulk inserting");
                res.send({ result: 'error' });
                return;
            }

            console.log("bulk inserted");
            res.send({ result: 'ok' });
            return;

        });

    }

    //res.send({ result: 'error' });

});


//--sorosh-------------------------

var soroshStr = "";

app.get('/sorosh', function (req, res) {

    
  
    //console.log(req.query);

    //console.log(req.url);

	if(req.query.gpsdata !== ""){
	
		res.setTimeout(180000, function () {
	        console.log('Request has timed out.');
	        res.send(408);

	       
		});

        res.on('finish', function () {
            console.log("read : " + req.socket.bytesRead);
			console.log("write : " + req.socket.bytesWritten);
        });
        
	
	var data = req.query.gpsdata.split(",");
	//0000-00-00 00:00:00
	
	//0123 45 67 89 01 23
	//2010 10 10 00 02 09
	
	/*
	var date = "";
	
	if(data[3]!==undefined)
		date = data[3].substring(0, 4) + "-" + data[3].substring(4, 6)
		+ "-" + data[3].substring(6, 8) + " " + data[3].substring(8, 10) +
		":" + data[3].substring(10, 12) + ":" + data[3].substring(12, 14);

	console.log("location_device_id, location_lat, location_lon, location_date, location_speed",
	[req.query.device_id, data[1], data[0], date,  data[6]]);

	insertBulk("location", "location_device_id, location_lat, location_lon, location_date, location_speed",
        [[req.query.device_id, data[1], data[0], date,  data[6]]], function (err) {

            if (err) {

                console.log("error bulk inserting");
                //res.send({ result: 'error' });
                //return;
            }

            console.log("bulk inserted");
            //res.send("salam1");
	   //return;

        });*/

	fs.appendFile('sorosh/sorosh.txt', req.url+"\r\n", function (err) {
	  if (err) console.log( err );
	  console.log('The "data to append" was appended to file!');
	});
	}
		

    soroshStr += (req.url) + "<hr /><br />";

    //res.status(200).send("salam");


    //res.writeHead(200, {'Content-Type': 'text/plain'});
   // res.write("salam");
    //res.end();

	res.send("salam");

    /*
	var i = 1;
	var func = function (i) {

	    setTimeout(function () {
	        console.log('salam' + i);
	        res.write("salam" + i);

		if( i < 10)
	        	func(++i);
		else
			res.end();

	    }, 3000);

	};

	func(i);
*/
});

/*
app.get('/sorosh', function (req, res) {

	res.setTimeout(180000, function () {
	        console.log('Request has timed out.');
	        res.send(408);
	});

    var data = req.query.gpsdata.split(",");
    //0000-00-00 00:00:00

    //0123 45 67 89 01 23
    //2010 10 10 00 02 09
    var date = data[3].substring(0, 4) + "-" + data[3].substring(4, 6)
    + "-" + data[3].substring(6, 8) + " " + data[3].substring(8, 10) +
    ":" + data[3].substring(10, 12) + ":" + data[3].substring(12, 14);

    console.log("location_device_id, location_lat, location_lon, location_date, location_speed",
    [req.query.device_id, data[1], data[0], date, data[6]]);

    insertBulk("location", "location_device_id, location_lat, location_lon, location_date, location_speed",
        [[req.query.device_id, data[1], data[0], date, data[6]]], function (err) {

            if (err) {

                console.log("error bulk inserting");
                //res.send({ result: 'error' });
                return;
            }

            console.log("bulk inserted");
            //res.send("salam1");
            return;

        });

    fs.appendFile('sorosh.txt', req.url + "\r\n", function (err) {
        if (err) console.log(err);
        console.log('The "data to append" was appended to file!');


        soroshStr += (req.url) + "<hr /><br />";



        res.send("salam");

    });

});
*/

//app.get('/sorosh', function (req, res) {

//    res.setTimeout(180000, function () {
//        console.log('Request has timed out.');
//        res.send(408);
//    });

//    console.log(req.url);

//    soroshStr += (req.url) + "<hr /><br />";

//    res.status(200).send("salam");


//    res.writeHead(200, {
//        'Content-Type': 'text/plain',
//    });
//    res.write("salam");
//    res.end();

//    /*
//	var i = 1;
//	var func = function (i) {

//	    setTimeout(function () {
//	        console.log('salam' + i);
//	        res.write("salam" + i);

//		if( i < 10)
//	        	func(++i);
//		else
//			res.end();

//	    }, 3000);

//	};

//	func(i);
//*/
//});

app.get('/sorosh2', function (req, res) {

    res.send(soroshStr);
});



//--------------------------

function getDistance(from, to) {

    var currLat = from.lat;
    var currLon = from.lon;

    var pointLat = to.lat;
    var pointLon = to.lon;

    var R = 6371;                   //Radius of the earth in Km             
    var dLat = (pointLat - currLat).toRad();    //delta (difference between) latitude in radians
    var dLon = (pointLon - currLon).toRad();    //delta (difference between) longitude in radians

    currLat = currLat.toRad();          //conversion to radians
    pointLat = pointLat.toRad();

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(currLat) * Math.cos(pointLat);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));   //must use atan2 as simple arctan cannot differentiate 1/1 and -1/-1
    var distance = R * c;   //sets the distance

    //distance = Math.round(distance * 10) / 10;      //rounds number to closest 0.1 km

    //console.log(from, to, distance);

    return distance;    //returns the distance

}

Number.prototype.toRad = function () {
    return this * Math.PI / 180;
}


function convertXXXXToXX(xxxx) {

    xxxx = String(xxxx);

    var re = /[0-9]{4}.[0-9]+/;
    var m;

    if ((m = re.exec(xxxx)) !== null) {

        var xx = Number(xxxx.substring(0, 2));

        var secondPart = Number(xxxx.substring(2, xxxx.length));

        return xx + (secondPart / 60);
    }

    return;
}


function checkDate(str) {

    str = String(str);

    var re = /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.+/;
    var m;

    if ((m = re.exec(str)) !== null) {

        return true;
    }

    return false;

}

function convertToMysqlDate(str) {

    str = String(str);

    var re = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.*$/;

    var re2 = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    var re3 = /^[0-9]{4}\/[0-9]{2}\/[0-9]{2}$/;

    var re4 = /^[0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}.*$/;
    var re5 = /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}.*$/;

    var re6 = /^[0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}$/;
    var re7 = /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$/;

    var m;


    console.log(str);

    if ((m = re.exec(str)) !== null) {
        //2014-09-30T14:51:02.000Z
        var date = str.substring(0, 4) + "-" + str.substring(5, 7)
          + "-" + str.substring(8, 10) + " " + str.substring(11, 13) +
          ":" + str.substring(14, 16) + ":" + str.substring(17, 19);

        return date;
    }
    else if ((m = re2.exec(str)) !== null || (m = re3.exec(str)) !== null) {
        //2014-09-30T14:51:02.000Z
        var date = str.substring(0, 4) + "-" + str.substring(5, 7)
          + "-" + str.substring(8, 10) + " 00:00:00";

        return date;
    }
    else if ((m = re4.exec(str)) !== null || (m = re5.exec(str)) !== null) {
        //2014-09-30T14:51:02.000Z
        var date = str.substring(0, 4) + "-" + str.substring(5, 7)
          + "-" + str.substring(8, 10) + " " + str.substring(11, 13) +
          ":" + str.substring(14, 16) + ":" + str.substring(17, 19);

        return date;
    }

    else if ((m = re6.exec(str)) !== null || (m = re7.exec(str)) !== null) {
        //2014-09-30T14:51:02.000Z
        var date = str.substring(0, 4) + "-" + str.substring(5, 7)
          + "-" + str.substring(8, 10) + " " + str.substring(11, 13) +
          ":" + str.substring(14, 16) + ":00";

        return date;
    }


    return;

}


var server = http.createServer(app);

server.listen(port, function () {

    console.log('running 127.0.0.1:8080');

});


console.log("file server running");



////////////////////////////////
// SOCKET.IO
//////////////////////////////////
var io = require('socket.io')(server);

var socketsMap = {};

io.on('connection', function (socket) {

    console.log(socket.id + " connected");

    function sendHello() {

        socket.emit('news', { hello: 'world' });

        setTimeout(function () {
            sendHello();
        }, 30000);
    }

    sendHello();

    socket.on('message', function (m) {
        console.log(socket.id + " sent "+ m);
    });


    socket.on('introduce', function (o) {

        var deviceId = o.device_id;

        if (deviceId in socketsMap) {
            // nothing
        } else {
            socketsMap[deviceId] = socket;
			
			console.log("introduce : " + o.device_id);
        }
    });
    
    socket.on("disconnect", function () {
        console.log(socket.id + " disconnected");

    });
});

function sendTaskToSocket(deviceId, task) {
    var socket;

	
	
    if (deviceId in socketsMap) {
        
		console.log(task);
		
        socket = socketsMap[deviceId];

        socket.emit("task", task);
        return true;
    }

    return false;
}