// setting up environment
var env = process.env.NODE_ENV || 'development';
var config = require('./config')[env];


// Import the installed modules.
const express = require('express');
const responseTime = require('response-time')
const axios = require('axios');
const redis = require('redis');
const bodyParser = require('body-parser');
const api_key = config.api_key;
const baseUrl = "https://api2.autopilothq.com/v1/contact";


const app = express();

// create and connect redis client to local instance.
const client = redis.createClient();

// Print redis errors to the console
client.on('error', (err) => {
  console.log("Error " + err);
});

// use response-time as a middleware
app.use(responseTime());
//app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


//post endpoint
app.post('/contacts', (req, res) => {
  const url = baseUrl+"?apikey=" + api_key;

  if(!req.body.Email){
    return res.status(400).send('Email is required to create a conatct');
  }
  if(!req.body.FirstName) {
    return res.status(400).send('Email is required to create a conatct');
  }
  if(!req.body.LastName){
    return res.status(400).send('Email is required to create a conatct');
  }

  const data = {
    "contact": req.body
    };

  return axios.post(url, data)
  .then((response) => {
    console.log("Created contact "+response.data.contact_id);
    return res.status(200).json(response.data);
  })
  .catch((error) => {
    console.error(error);
    return res.send(err.message);
  })
});


// get endpoint
// get all contacts
app.get('/contacts',(req , res) => {
  const url = "https://api2.autopilothq.com/v1/contacts"+"?apikey=" +api_key;
  return axios.get(url)
    .then(response => {
      // Send JSON response to client
      return res.status(200).json(response.data);
    })
    .catch(err => {
      console.log("Error "+err.message);
      return res.send(err.message);
    });
});


// create an contacts/<id> endpoint
// get details of specific conatct.
app.get('/contacts/:email_or_id', (req, res) => {
  // Extractb parameter from url
  const email_or_id = req.params.email_or_id;

  // Build the Autopilot API url
  const url = baseUrl+"/"+email_or_id+"?apikey=" + api_key;

  // Try fetching the result from Redis first in case we have it cached
  //unique key pattern for redis cache "autopilot:<email>:<contact_id>"
  client.keys("autopilot:*"+email_or_id+"*",(err,key) => {
      if (err) return console.log(err);
      client.get(key,(err, result) => {
          if (result != null) {
            console.log("Extracting from cache");
            return res.send(result);
          }
          else {
            // get results from API call as results are not present in
            // redis cache
            return axios.get(url)
              .then(response => {
                const responseJSON = JSON.stringify(response.data);
                client.set("autopilot:"+response.data.Email+":"+response.data.contact_id, responseJSON);
                // Send response
                return res.status(200).send(response.data);
            })
            .catch(err => {
              return res.send(err.message);
            }) //catch
        }
      });

    });
});


//put endpoint
app.put('/contacts/update', (req, res) => {
  const url = baseUrl+"?apikey=" + api_key;

  if(!req.body.Email){
    return res.status(400).send('Email is required to create a conatct');
  }

  const data = {
    "contact": req.body
    };

  return axios.post(url, data)
  .then((response) => {
    console.log("Updated contact "+response.data.contact_id);
    // delete entry in cache as contact is updated.
    client.keys("autopilot:*"+response.data.contact_id+"*",(err,key) => {
        if (err) return console.log(err);
        if (key != "") {
          client.del(key);
      }
    });
    return res.status(200).json(response.data);
  })
  .catch((error) => {
    console.error(error);
    return res.send(err.message);
  })
});



app.listen(config.server.port, () => {
  console.log('Server listening on port: ', config.server.port);
});
