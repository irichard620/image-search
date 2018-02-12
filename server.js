 /******************************************************
 * PLEASE DO NOT EDIT THIS FILE
 * the verification process may break
 * ***************************************************/

'use strict';

var fs = require('fs');
var express = require('express');
var app = express();
var mongoClient = require('mongodb').MongoClient;
var https = require('https');

if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

// Start mongo client
var db;
mongoClient.connect(process.env.DB_URL, function(err, client) {
  if (err) {
    console.log(err);  
  } else {
    console.log("Connected successfully to server");

    db = client.db('fcc-ian-image-search');
  }
});

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });
  
app.route('/')
    .get(function(req, res) {
		  res.sendFile(process.cwd() + '/views/index.html');
    })

app.get('/api/imagesearch/:tags', function(req, res) {
  var queryString = req.params.tags;
  
  // Handle offset
  var offsetTag = req.query.offset;
  var offset = 1;
  if (typeof offsetTag !== 'undefined' && offsetTag) {
    var adjustedValue = parseInt(offsetTag);
    if (isNaN(adjustedValue)) {
      offset = 1;
    } else {
      offset += adjustedValue;
    }
  }
  
  // Make request
  https.get("https://www.googleapis.com/customsearch/v1?q=" + queryString + "&cx=000383790710069353881%3Axnau2ehcdse&num=10&searchType=image&fields=items(image(contextLink%2CthumbnailLink)%2Clink%2Csnippet%2Ctitle)&start=" + offset + "&key=" + process.env.API_KEY, function(searchRes) {
    var output = '';
    searchRes.setEncoding('utf8');

    searchRes.on('data', function (chunk) {
      output += chunk;
    });

    searchRes.on('end', function() {
      var obj = JSON.parse(output);
      
      // Before we send object back, save search to mongo
      var latestCollection = db.collection('latest');
      var currentDate = new Date();
      latestCollection.insert({
        "term": queryString,
        "when": currentDate
      }, function(err, data) {
        if (err) {
          console.log(err);
          res.send({"err": err});
        } else {
          res.send(obj.items);
        }
      });
    });
  }).on('error', (e) => {
    console.error(e);
  });
});

app.get('/api/latest/imagesearch', function(req, res) {
  var latestCollection = db.collection('latest');
  latestCollection.find({}, {sort: {when: -1}}).limit(10).project({"_id": 0, "term": 1, "when": 1}).toArray(function (err, docs) {
    if (err) {
      console.log(err);
      res.send({"err": err});
    } else {
      res.send(docs);
    }
  });
});

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
})

app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});

