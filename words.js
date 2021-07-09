const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");
const download = require("download");
const { wait, slug, getAudio, getAllMp3, translate } = require("./utils");
const path = require("path");
const axios = require("axios");
const n = require("normalize-text");
const _ = require("lodash");

const textSource = "largeText.txt"; // "longText1.txt";
const splitter = "XYFNKW";
const examplexPerWord = 5;
const wordsPerPage = 10;
const howManyPages = 5;
const rowTextLenght = 500100; //333444; //900090009;
const sentenceLenghtMin = 15;
const sentenceLenghtMax = 50;

const makeWordsList = () => {
  return new Promise((resolve, reject) => {
    const file = path.resolve(__dirname, textSource);
    fs.readFile(file, "utf8", function (err, text) {
      if (err) return console.log(err);

      const normalizedText = getText(text);
      fs.writeFile(
        path.resolve(__dirname, "mp3", `0normalizedText.txt`),
        normalizedText,
        (err) => {
          if (err) return console.log(err);
          // console.log("CREATED => normalizedText.txt");
        }
      );

      // 2 get sentences
      const sentences = getSentences(normalizedText);

      // 3 get words object
      const words = getWords(normalizedText, sentences);

      const wordsChunk = _.chunk(words, wordsPerPage).slice(0, howManyPages);
      // console.log(wordsChunk);

      let counter = 0;
      for (chunk of wordsChunk) {
        counter++;
        fs.writeFileSync(
          path.resolve(__dirname, "mp3", `words-${counter}.json`),
          JSON.stringify(chunk)
        );
      }

      // console.log("xxxxxxxxxxxxxxxxxx", words.length);
      resolve({ normalizedText, words, sentences });
    });
  });
};

const getText = (text) => {
  // console.log(text.length);
  // 1 normalize text
  let t = text.slice(0, rowTextLenght);

  // 2 remove caracters
  t = t.replace(/\]/g, "");
  t = t.replace(/\[/g, "");
  t = t.replace(/\=/g, " ");
  t = t.replace(/\"/g, "");
  t = t.replace(/\“/g, "");
  t = t.replace(/\”/g, "");
  t = t.replace(/\.\.\./g, "");
  t = t.replace(/\.\./g, "");
  t = t.replace(/\;/g, "");

  // 3 replace caracters
  t = t.replace(/\t/g, " ");
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\. /g, `.${splitter}`);
  t = t.replace(/\? /g, `?${splitter}`);
  t = t.replace(/\! /g, `!${splitter}`);

  return t;
};

const getSentences = (text) => {
  const sentences = text.split(splitter);

  const filteredS = sentences.filter(
    (s) =>
      s !== undefined &&
      s !== ". " &&
      s.length >= sentenceLenghtMin &&
      s.length <= sentenceLenghtMax
  );

  const uniq = _.uniqBy(filteredS, (item) => item);

  const orderedSentences = uniq.sort((a, b) => a.length - b.length);

  return orderedSentences;
};

const getWords = (text, sentences) => {
  let rowText = text;
  rowText = rowText.replace(new RegExp(splitter, "g"), ` `);
  rowText = rowText.replace(/\:/g, ``);
  rowText = rowText.replace(/\;/g, ``);
  rowText = rowText.replace(/\./g, ``);
  rowText = rowText.replace(/\?/g, ``);
  rowText = rowText.replace(/\!/g, ``);
  rowText = rowText.replace(/\,/g, ``);

  const rowWords = rowText.split(" ");
  const wordsFiltered = rowWords.filter((w) => w.length > 1);

  const countWords = _.countBy(wordsFiltered);

  const words = Object.entries(countWords).map((item) => {
    const word = {
      word: item[0],
      count: item[1],
      examples: [],
    };

    return word;
  });

  const wordsOrdered = _.orderBy(words, ["count"], ["desc"]);

  const first1000words = wordsOrdered.slice(0, 1000).map((w) => w.word);

  const examples = createExamplesArray(sentences, first1000words);
  // console.log("examples", examples.length);

  const wordsWithExamples = wordsOrdered.map((item) => {
    const newItem = { ...item };
    // console.log(1, newItem);

    for (let i = 1; i <= examplexPerWord; i++) {
      const index = examples.findIndex((example) => {
        const exampleLowerCase = example
          .toLowerCase()
          .replace(/\. /g, "")
          .replace(/\? /g, "")
          .replace(/\! /g, "");

        return exampleLowerCase.split(" ").includes(item.word.toLowerCase());
      });
      if (index !== -1) newItem.examples.push(...examples.splice(index, 1));
    }

    return newItem;
  });

  return wordsWithExamples;
};

const createExamplesArray = (sentences, first1000words) => {
  const examples = [...sentences];
  // console.log("examples", examples);

  const easyExamples = examples.filter((item) => check(item, first1000words)); // examples that contains only words from "first1000words"
  // console.log("easyExamples", easyExamples);

  const result = _.uniqBy([...easyExamples, ...examples], (item) => item);

  return result;
};

const check = (sentence, first1000words) => {
  const wordsArr = sentence
    .toLowerCase()
    .replace(/\. /g, "")
    .replace(/\? /g, "")
    .replace(/\! /g, "")
    .split(" ");

  // console.log("words =", wordsArr, first1000words);
  for (let i = 0; i < wordsArr.length; i++) {
    if (!first1000words.includes(wordsArr[i])) return false;
  }
  return true;
};
module.exports = { makeWordsList };
