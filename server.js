// 
// Action on google to get interesting stuff from wikipedia and get smarter
// @author: Ido Green | @greenido
// @date: Dec 2017
// @see:
// https://github.com/greenido/bitcoin-info-action
// http://expressjs.com/en/starter/static-files.html
// http://docs.sequelizejs.com/manual/tutorial/models-definition.html#database-synchronization

// init project pkgs
const wikipedia = require("wikipedia-js");
const express = require('express');
const ApiAiAssistant = require('actions-on-google').ApiAiAssistant;
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const Map = require('es6-map');

// so we could save the queries for later improvments
var Sequelize = require('sequelize'); 
var KeywordDB;

// Pretty JSON output for logs
const prettyjson = require('prettyjson');
const toSentence = require('underscore.string/toSentence');

app.use(bodyParser.json({type: 'application/json'}));
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});


// Calling GA to make sure how many invocations we had on this skill
const GAurl = "https://ga-beacon.appspot.com/UA-65622529-1/wikipeida-friend-glitch-server/?pixel=0";
request.get(GAurl, (error, response, body) => {
  console.log(" - Called the GA - " + new Date());
});

// Handle webhook requests
app.post('/', function(req, res, next) {
  
  //logObject('Request headers: ', req.headers);
  //logObject('Request body: ', req.body);
    
  // Instantiate a new API.AI assistant object.
  const assistant = new ApiAiAssistant({request: req, response: res});
  
  const keywords = assistant.getArgument('user-keywords');
  // Declare constants for your action and parameter names
  const KEYWORD_ACTION = 'keyword'; 
  logObject('user-keywords' , keywords);
  
  //
  // trim words so we won't talk for more than 2 minutes.
  //
  function trimToWordsLimit(limit, text) {
    if (text == null) {
      return "";
    }
    
    var words = text.match(/\S+/g).length;
    var trimmed = text;
    if (words > limit) {
        // Split the string on first X words and rejoin on spaces
        trimmed = text.split(/\s+/, limit).join(" ");
    }
    return trimmed;
  }
  
  //
  // Coz wikipedia api return some data fields not inside tags :/
  //
  function cleanHTMLTags(html) {
    if (html != null && html.length > 1) {
      let text = html.replace(/<(?:.|\n)*?>/gm, '');
      let inx1 = 0;
      let foundDataField = text.indexOf("data-");
      while (inx1 < text.length && foundDataField > 0) {
        let inx2 = text.indexOf(">", inx1) + 1;
        text = text.substring(0,inx1) + text.substring(inx2, text.length);
        inx1 = inx2 + 1;
        foundDataField = text.indexOf("data-", inx1);
      } 
      return text;  
    }
    //
    return html;
  }
  
  // Create functions to handle intents here
  function getWikiResults(assistant) {
    console.log('** Handling action: ' + KEYWORD_ACTION);
    if (keywords.length > 2) {
      var options = { query: keywords, format: "html", summaryOnly: true }; //prop: "extracts", explaintext: "1"}
      wikipedia.searchArticle(options, function(err, htmlWikiText) {
          if (err) {
              console.log("An error occurred. Options: " + JSON.stringify(options) + " Err: " + err);
              assistant.tell("Sorry something is not working at the moment. Please try again laster.");
              var ts = Math.round((new Date()).getTime() / 1000);
              KeywordDB.create({ time: ts, keyword: keywords, status: "KAKA - Err: " + err});
              return;
          }
          // console.log("== Raw text we got from API: " + htmlWikiText);
          let textOnly = cleanHTMLTags(htmlWikiText); //   cleanHTMLTags  .replace(/<(?:.|\n)*?>/gm, '');
          textOnly = cleanHTMLTags(textOnly);
          textOnly = cleanHTMLTags(textOnly);
          textOnly = cleanHTMLTags(textOnly);
          // Let's have 100 words per answer as we have limit of 2min per response.
          let textTrimmed = trimToWordsLimit(100, textOnly);
          // so we can full sentance and not in the middle
          let inx1 = textTrimmed.lastIndexOf("."); 
          textTrimmed = textTrimmed.substring(0, inx1);
          console.log("For " + keywords + " We got: " + textTrimmed);
          let res = "So for " + keywords + " I could not find any article. What something else?"; //<speak>
          var ts = Math.round((new Date()).getTime() / 1000);
          if (textTrimmed.length > 2) {
            res = "For " + keywords + ' I got this explanation, ' + textTrimmed + ". What something else?"; //<break time="400ms"/>
            KeywordDB.create({ time: ts, keyword: keywords, status: "GOOD"});
          }
          else {
            KeywordDB.create({ time: ts, keyword: keywords, status: "KAKA - Got Nothing"});
          }
          assistant.ask(res);
      });
    } 
    else {
      // Using 'ask' and not 'tell' as we don't wish to finish the conversation
      assistant.ask("Sorry but you will need to give me a real term. What do you wish to search?");
    }
  }
  
  // Add handler functions to the action router.
  let actionRouter = new Map();
  actionRouter.set(KEYWORD_ACTION, getWikiResults);
  
  // Route requests to the proper handler functions via the action router.
  assistant.handleRequest(actionRouter);
});

//
// Handle errors
//
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Oppss... could not check the western state results');
})

//
// Pretty print objects for logging
//
function logObject(message, object, options) {
  console.log(message);
  console.log(prettyjson.render(object, options));
}

//
// DB stuff
//

try {
    // setup a new database
    // using database credentials set in .env
    var sequelize = new Sequelize('database', process.env.DB_USER, process.env.DB_PASS, {
      host: '0.0.0.0',
      dialect: 'sqlite',
      pool: {
        max: 5,
        min: 0,
        idle: 10000
      },
      storage: '.data/database.sqlite'
    });
  
    sequelize.authenticate()
    .then(function(err) {
      console.log('Connection has been established successfully to our DB');
      // define a new table
      KeywordDB = sequelize.define('searches', {
        time: {
          type: Sequelize.INTEGER
        },
        keyword: {
          type: Sequelize.STRING
        },
        status: { 
          type: Sequelize.STRING
        }
      });

      KeywordDB.sync({force: false}).then(() => {
        /* Table created
        var ts = Math.round((new Date()).getTime() / 1000);
        return KeywordDB.create({
          time: ts,
          keyword: 'first-one',
          status: 'N/A'
        }); */
        console.log('** Synced with the database.');  
      });
    })
    .catch(function (err) {
      console.log('Unable to connect to the database: ', err);
    });

  }
  catch(e) {
    console.log('ERROR with the database: ', e);
  }


//
// Listen for requests -- Start the party
//
let server = app.listen(process.env.PORT, function () {
  console.log('--> Our Webhook is listening on ' + JSON.stringify(server.address()));
});