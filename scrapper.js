const axios = require("axios");
const cheerio = require("cheerio");
const { slug, createFolder, write } = require("./utils");

const url = "https://www.diki.pl/slownik-angielskiego?q=";
// const url = "https://dictionary.cambridge.org/pl/dictionary/english-polish/";

const scrapper = async (text) => {
  if (!text) return [];
  const translationsArray = [];
  async function fetchHTML(url) {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  }

  try {
    const $ = await fetchHTML(`${url}${slug(text)}`);
    const x = $(".foreignToNativeMeanings .hw").each(function () {
      const translation = $(this).text();
      // const exampleSentence = $(this).find(".exampleSentence").text();

      translationsArray.push({ translation });
    });

    createFolder("dictionary");
    write(`dictionary/${slug(text)}.json`, translationsArray);
    // const x = $(".trans").each(function () {
    //   const singleTranslation = $(this).text();
    //   translationsArray.push(singleTranslation);
    // });
  } catch (err) {
    return translationsArray;
  }

  return translationsArray;
};
module.exports = {
  scrapper,
};
