// get all the require
var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 4000;

// Initialize Express
var app = express();

//Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");
// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder

// Connect to the Mongo DB

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/foxScrape";
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

// Routes

// A GET route for scraping the echoJS website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.foxnews.com/world").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // Now, we grab every h2 within an article tag, and do the following:
    $("article h2").each(function(i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children("a")
        .text();
      result.link = $(this)
        .children("a")
        .attr("href");

      if (!result.link.includes("http")) {
        // Create a new Article using the `result` object built from scraping
        db.Article.create(result)
          .then(function(dbArticle) {
            // View the added result in the console
            console.log(dbArticle);
          })
          .catch(function(err) {
            // If an error occurred, log it
            console.log(err);
          });
      }
    });

    // Send a message to the client
    // res.send("Scrape Complete");
    res.redirect("/");
  });
});


// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  console.log(req.body);
  try {
    db.Note.create(req.body).then(function(dbResult) {
      db.Article.findByIdAndUpdate(req.params.id, {
        $push: { note: dbResult._id },
        new: true
      }).then(function(finalResult) {
        res.redirect("/");
      });
    });
  } catch (error) {
    console.log("WE HAVE AN ERROR", error);
  }
});

app.post("/deletenote/:noteId/:articleId", function(req, res) {
  db.Note.findByIdAndRemove(req.params.noteId).then(function(dbResult) {
    db.Article.findByIdAndUpdate(req.params.articleId, {
      $pull: { note: req.params.noteId },
      new: true
    }).then(function(final){
      res.redirect("/")
    });
  });
});

app.get("/", function(req, res) {
  db.Article.find({})
    .populate("note")
    .then(function(dbArticle) {
      console.log(dbArticle);
      var hbsObject = {
        article: dbArticle
      };
      res.render("index", hbsObject);
    })
    .catch(function(err) {
      res.json(err);
    });
});

app.get("/my-article/:id", function(req, res) {
  var id = req.params.id;

  db.Article.findById(id)
    .populate("Note")
    .then(function(dbArticle) {
      res.render("my-article", dbArticle);
    });
});
// Start the server
app.listen(PORT, function() {
  console.log("App running on http://localhost:" + PORT);
});
