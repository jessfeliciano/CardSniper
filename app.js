// This file has routes that scrape current listing available on Ebay based on search
// To get started, run file and navigate to "/search/pokemon"


var express = require("express");
var app = express();
const axios = require("axios");
const cheerio = require("cheerio");
const fakeUa = require("fake-useragent");

//https://apkcombo.com/fr-ma/apk-downloader/?device=&arch=&android=&q=com.candybomb.blast

app.set("port", process.env.PORT || 3000);
app.use(express.static('./public'))

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// POST route to gather user search information
app.post('/user-search', (req, res) => {
    let search = req.body.search;
    if(search){
      res.status(200).send(`Trying to grab users search text ${search}`);
      console.log(`Search text: ${search}`)
      return search;
    } else{
      res.status(500).json({message: err.message})
    }
});

// Webscraping routes
app.get("/id/*", (req, res) => {
  let pathname = req.path.substring(1).split("/");
  let id = pathname[1];
  console.log(req.query.domaine);
  console.log(id);
  let domaine = req.query.domaine ? req.query.domaine : "com";
  let url = "https://www.ebay." + domaine + "/itm/" + id;
  console.log(url);
  axios
    .get(url, {
      headers: {
        "User-Agent": fakeUa(),
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      withCredentials: true,
    })
    .then(function (response) {
      let itemData = {};
      const $ = cheerio.load(response.data);
      if ($("#msgPanel").text().trim().includes("ended")) {
        itemData.status = "close";
      } else {
        itemData.status = "open";
      }
      itemData.icon = $("#icImg").attr("src");
      itemData.category = $(
          "#vi-VR-brumb-lnkLst > table > tbody > tr > td > ul > li:nth-child(1) > a > span"
        )
        .text()
        .trim();
      itemData.categoryId = $(
        "#vi-VR-brumb-lnkLst > table > tbody > tr > td > ul > li:nth-child(1) > a"
      ).attr("href");
      itemData.categoryId = itemData.categoryId.substring(
        itemData.categoryId.lastIndexOf("/") + 1
      );
      itemData.totaleRating = parseRate($("#_rvwlnk").text().trim());
      //#rwid > div.reviews-left > div.ebay-content-wrapper > span.ebay-review-start-rating
      itemData.rating = parseFloat(
        $(
          "#rwid > div.reviews-left > div.ebay-content-wrapper > span.ebay-review-start-rating"
        )
        .text()
        .trim()
      );

      directUrl = $("#itemTitle")
        .contents()
        .filter(function () {
          return this.nodeType == 3;
        })
        .text()
        .trim();
      itemData.title = directUrl;
      let imageUrls = $("a[id^='vi_main_img_fs_thImg'] img")
        .map((i, x) => $(x).attr("src"))
        .toArray();

      let price = $("#prcIsum").text().trim();

      if (price.length == 0) {
        price = $("#mm-saleDscPrc").text().trim();
      }
      if (price.length == 0) {
        price = $("#prcIsum_bidPrice").text().trim();
      }
      if (price.length == 0) {
        price = $("#orgPrc").text().trim();
      }
      price = price.replace(',', '');
      let regex = /[+-]?\d+(\.\d+)?/g;
      itemData.priceRange = false;
      let p = parseFloat(price.match(regex)[0])
      let c = price.replace(/[0-9\.,]+/g, "")
      if (c.includes(' ')) {
        c = c.split(' ')[0]
      }
      itemData.price = {
        amount: p,
        currency: c,
      };
      itemData.description = $('#viTabs_0_pd > div > table > tbody > tr:nth-child(2) > td > span').text();
      itemData.images = imageUrls;
      //scrape srs
      //scrapeSRS($, $("#SRPSection"), itemData);
      itemData.seller = getSellerData($, itemData);
      itemData.srs = scrapeSRS($, itemData);
      itemData.reviews = getReviews(
        $,
        $("#rwid > div.reviews-right > div.reviews > div")
      );
      itemData.itemSpecifics = getItmSpecifics($, $("#viTabs_0_is tbody"));
      res.set({
        "content-type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(itemData));
    })
    .catch(function (error) {
      console.log(error);
      res.end("problem");
    });
});

// This is the route I mostly care about because this is a search by search term
app.get("/search/*", function (req, res) {
  let search = req.query.search;
  console.log("Body test: " + search)
  let pathname = req.path.substring(1).split("/");
 // console.log(`Search Term: ${search}`);
  //let id = pathname[1];
  let id = search;
  console.log(`Pathname: ${id}`);
  let domaine = req.query.domaine ? req.query.domaine : "com";
  let perpage = req.query.num ? req.query.num : 50;
  let url = "https://www.ebay." + domaine + "/sch/" + id + "?&_ipg=" + perpage + "&LH_BIN=1";
  console.log(`Ebay Searched URL: ${url}`);

  axios
    .get(url, {
      headers: {
        "User-Agent": fakeUa(),
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      withCredentials: true,
    })
    .then(function (response) {
      let data = {};
      data.products = [];
      const $ = cheerio.load(response.data);
      let items = $("#srp-river-results > ul > li.s-item");
     // console.log(items);

      items = items.filter((i, elem) => {
        let text = $(elem)
          .find(
            "div > div.s-item__info.clearfix > div.s-item__details.clearfix > div:nth-child(1) > span"
          )
          .text();

        return !text.includes('Tap item to see current price');
      })

      let products = [];
      items.each((i, elem) => {
        let itemData = {};
        itemData.imageURL = $(elem)
          .find(
            "div > div.s-item__image-section > div > a:nth-child(1) > div > img"
          )
          .attr("src");
        //div > div.s-item__info.clearfix > a > h3
        itemData.title = $(elem)
          .find("div > div.s-item__info.clearfix > a > h3")
          .text()
          .trim();
        //div > div.s-item__info.clearfix > div.s-item__details.clearfix > span:nth-child(4) > span
        itemData.description = $(elem)
          .find("div > div.s-item__info.clearfix > div.s-item__subtitle")
          .text()
          .trim();
        itemData.shipingFrom = $(elem)
          .find(
            " div > div.s-item__info.clearfix > div.s-item__details.clearfix > span.s-item__detail--secondary"
          )
          .filter(function (i, elem) {
            return $(elem).text().trim().includes("From");
          })
          .text();
        if (itemData.shipingFrom.length == 0) {
          itemData.shipingFrom = "From United States";
        }

        //div > div.s-item__info.clearfix > div.s-item__details.clearfix > span:nth-child(4) > span
        // div > div.s-item__info.clearfix > div.s-item__reviews > a > span > span:nth-child(1)
        itemData.totaleRating = parseRate(
          $(elem)
          .find(
            "div > div.s-item__info.clearfix > div.s-item__reviews > a > span > span:nth-child(1)"
          )
          .text()
        );
        itemData.productId = new URL(
          $(elem).find("div > div.s-item__info.clearfix > a").attr("href")
        ).pathname.split("/")[3];
        let regex = /[+-]?\d+(\.\d+)?/g;
        let price = $(elem)
          .find(
            "div > div.s-item__info.clearfix > div.s-item__details.clearfix > div:nth-child(1) > span"
          )
          .text().replace(',', '');

        if (price.includes('to') && price.match(regex)) {

          itemData.priceRange = true;
          let [min, max] = price.match(regex).map(elem => parseFloat(elem));

          let curr = price.split(' ')[0].replace(/[0-9\.,]+/g, "")

          itemData.price = []
          itemData.price.push({
            amount: min,
            currency: curr
          })
          itemData.price.push({
            amount: max,
            currency: curr
          })

        } else {
          itemData.priceRange = false;

          itemData.price = {
            amount: parseFloat(price.match(regex)[0]),
            currency: price.replace(/[0-9\.,]+/g, "")
          }
        }
        itemData.averageRating = parseRate(
          $(elem)
          .find(
            "div > div.s-item__info.clearfix > div.s-item__reviews > a > div > span"
          )
          .text()
        );

        //#srp-river-results > ul > li:nth-child(7) > div > div.s-item__info.clearfix > a
        // div > div.s-item__info.clearfix > div.s-item__reviews > a > div > span
        data.products.push(itemData);
      });
      console.log(data);
      res.set({
        "content-type": "application/json; charset=utf-8",
      });

      res.end(JSON.stringify(data));
    })
    .catch(function (error) {
      console.log(error);
      res.end("problem");
    });
});

function getImages($) {
  let imgUrls = $(
    "#tab-panel-0-w0 > div.app-filmstrip__owl-carousel.owl-carousel.owl-loaded > div.owl-stage-outer > ul > li > figure > span.cc-image-component > img"
  );
  console.log(
    imgUrls.map((index, element) => {
      return $(element).attr("src").text();
    })
  );
}

function scrapeSRS($, itemData) {
  if (itemData.status == "close") {
    return {
      location: $(
          "#mainContent > div:nth-child(1) > table > tbody > tr:nth-child(8) > td > div > div:nth-child(2) > div:nth-child(2)"
        )
        .text()
        .trim(),
      shipping: $("#shSummary > span.vi-geo-na.shp-sub-text").text().trim(),
      delivery: " ",
    };
  } else {
    return {
      location: $(
          "#itemLocation > div.u-flL.iti-w75 > div > div.iti-eu-bld-gry > span"
        )
        .text()
        .trim(),
      shipping: shipingExtractData($("#shSummary").text().trim()),
      delivery: delivaryExtractData($("#delSummary").text()),
    };
    //#itemLocation > div.u-flL.iti-w75 > div > div.iti-eu-bld-gry > span
  }
  itemData.location = $(section)
    .find("div.u-flL.iti-w75 > div > div.iti-eu-bld-gry > span")
    .text();
}

function delivaryExtractData(str) {
  str = str.trim();
  let index = str.indexOf("\t");
  return str.substring(0, index == -1 ? str.length : index);
}

function getItmSpecifics($, table) {
  let itemSpecifics = {};
  $(table)
    .find("tr")
    .each(function (index, element) {
      itemSpecifics[$(element).find("td:nth-child(1)").text().trim()] = $(
          element
        )
        .find("td:nth-child(2)")
        .text()
        .trim();
      itemSpecifics[$(element).find("td:nth-child(3)").text().trim()] = $(
          element
        )
        .find("td:nth-child(4)")
        .text()
        .trim();
    });

  return itemSpecifics;
}

function getSellerData($, itemData) {
  let returnObj;
  if (itemData.status == "close") {
    returnObj = {
      //#RightSummaryPanel > div.si-cnt.si-cnt-eu > div > div > div:nth-child(3) > div.bdg-90 > div.mbg > a > span
      sellerName: $(
        "#mainContent > div:nth-child(1) > table > tbody > tr:nth-child(9) > td > div > div:nth-child(3) > div > div.mbg.vi-VR-margBtm3 > a > span"
      ).text(),
      score: $(
        "#mainContent > div:nth-child(1) > table > tbody > tr:nth-child(9) > td > div > div:nth-child(3) > div > div.mbg.vi-VR-margBtm3 > span > a"
      ).text(),
    }

  } else {
    returnObj = {
      sellerName: $(
        "#RightSummaryPanel > div.si-cnt.si-cnt-eu.vi-grBr.vi-padn0.c-std > div > div > div > div.bdg-90 > div.mbg.vi-VR-margBtm3 > a > span"
      ).text(),
      score: $(
        "#RightSummaryPanel > div.si-cnt.si-cnt-eu.vi-grBr.vi-padn0.c-std > div > div > div > div.bdg-90 > div.mbg.vi-VR-margBtm3 > span > a"
      ).text(),
    }
  }
  if (returnObj.sellerName.length == 0) {
    returnObj.sellerName = $('#RightSummaryPanel > div.si-cnt.si-cnt-eu.vi-grBr.vi-padn0.c-std > div > div > div > div.si-sp-shop > a').attr('title')
  }
  return returnObj
}

function parseRate(str) {
  return parseFloat(str.substring(0, str.indexOf(" ")));
}

function getReviews($, notfiltred) {
  let reviews = notfiltred.toArray().map((elem, i) => {
    return {
      rate: parseRate(
        $(elem).find("div.ebay-review-section-l > div").attr("aria-label")
      ),
      user: $(elem).find("div.ebay-review-section-l > a").text(),
      date: $(elem)
        .find("div.ebay-review-section-l > span.review-item-date")
        .text(),
      comment: {
        title: $(elem)
          .find("div.ebay-review-section-r > p.review-item-title.wrap-spaces")
          .text(),
        content: $(elem)
          .find("div.ebay-review-section-r > p.review-item-content.wrap-spaces")
          .text(),
      },
    };
  });

  return reviews;
}

function shipingExtractData(str) {
  str = str.replace(/\s+/g, " ");
  return str.substring(0, str.indexOf("|") - 1);
}
app.listen(app.get("port"), () => {
  console.log(app.get("port"));
});
