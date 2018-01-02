var wikipedia = require("wikipedia-js");
var query = "Napoleon Bonaparte";

//
//
//
function trimToWordsLimit(limit, text) {
    var words = text.match(/\S+/g).length;
    var trimmed = text;
    if (words > limit) {
        // Split the string on first X words and rejoin on spaces
        trimmed = text.split(/\s+/, 200).join(" ");
    }
    return trimmed;
}

// if you want to retrieve a full article set summaryOnly to false. 
// Full article retrieval and parsing is still beta 
var options = { query: query, format: "html", summaryOnly: true };
wikipedia.searchArticle(options, function(err, htmlWikiText) {
    if (err) {
        console.log("An error occurred[query=%s, error=%s]", query, err);
        return;
    }
    let textOnly = htmlWikiText.replace(/<(?:.|\n)*?>/gm, '');
    let textTrimmed = trimToWordsLimit(200, textOnly);
    let inx1 = textTrimmed.lastIndexOf("."); // so we can full sentance and not in the middle
    textTrimmed = textTrimmed.substring(0, inx1);
    console.log("For " + query + " We got: " + textTrimmed);
    //console.log("Query successful[query=" + query + ", html-formatted-wiki-text= " + htmlWikiText);

});

console.log("== done ===");