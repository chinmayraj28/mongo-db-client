const bodyParser = require('body-parser');
const mongoose = require('mongoose')
const express = require('express');
const app = express();
const route = express.Router();
const port = 80
let readyCheck = false

//Your Mongo URL
const { mongoUrl } = require('./config.json')

//App Config
app.set('view engine', 'ejs');
app.use((req, res, next) => {
    if(!mongoUrl){
        res.send("Fill in the mongodb url in config.json file. After filling it in, restart the app in the console.")
    }else{
        if (readyCheck === true) {
            next();
          } else {
            res.render('common/loading');
          }
    }
});

//Required For The Main Process
const delay = ms => new Promise(res => setTimeout(res, ms));
const collectionsByDatabase = {};
const updatedDb = []
const paths = []

//Mongoose
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => {
  console.log('Connected to MongoDB');
  mongoose.connection.client.db().admin().listDatabases()
    .then(async (result) => {
        
        //Getting All Databases
        const databases = result.databases.map((database) => database.name);
        databases.forEach(function(d){
            if(d === "local" || d === "admin" || d === "test") return
            updatedDb.push(d)
        })

        //Creating Paths
        updatedDb.forEach(async function(d){
            paths.push({path: `/${d}`, handler: async (req, res) => {
            //Handler Code

            await delay(2000)
            //Get All Collections
            result.databases.forEach(async (database) => {
                const dbName = database.name;
                if (d === "local" || dbName === 'admin' || dbName === 'test') return;
                    try {
                        const db = mongoose.connection.client.db(dbName);
                        const collections = await db.listCollections().toArray();
                        collectionsByDatabase[dbName] = collections.map((collection) => collection.name);
                    } catch (error) {
                    console.error(`Error retrieving collections for database '${dbName}':`, error);
                }
            });

            await delay(2000)

            //Get Data From All The Collections
            const collectionDataByDatabase = {};

            Object.keys(collectionsByDatabase).forEach(async (dbName) => {
                const collections = collectionsByDatabase[dbName];
                collectionDataByDatabase[dbName] = [];
                collections.forEach(async (collectionName) => {
                    try {
                        const db = mongoose.connection.client.db(dbName);
                        const collectionData = await db.collection(collectionName).find().toArray(); 
                        collectionDataByDatabase[dbName].push({
                            collection: collectionName,
                            data: collectionData,
                        });
                    } catch (error) {
                        console.error(`Error retrieving data from collection '${collectionName}' in database '${dbName}':`, error);
                    }
                });
            });

            await delay(2000)
            res.render(`pages/renderEachPage`, {allDbs: updatedDb, dbName: d, dbNameStr: d.toString(), allCollections: collectionsByDatabase, allDataInCollection: collectionDataByDatabase})
        }})

        // Home Path
        paths.push({ path: `/`, handler: async (req, res) => {
            res.render('pages/home', {allDbs: updatedDb})
        }})

        //Loading All Paths
        paths.forEach(route => {
            app.get(route.path, route.handler);
        });
        await delay(1000)
        readyCheck = true
    })
    })
    .catch((error) => {
        console.error('Error retrieving databases:', error);
});
})
.catch((error) => {
  console.log('Error connecting to MongoDB:', error);
});


app.listen(port, () => {
    console.log(`Listening On Port: ${port}\nURL: http://localhost:${port}`)
})
