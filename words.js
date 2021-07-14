const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");
const download = require("download");
const {
  wait,
  slug,
  getAudio,
  getAllMp3,
  translate,
  createFolder,
  write,
} = require("./utils");
const path = require("path");
const axios = require("axios");
const n = require("normalize-text");
const _ = require("lodash");

// const conf.textSource = "largeText.txt"; // "longText1.txt";
// const conf.splitter = "XYFNKW";
// const conf.examplexPerWord = 1;
// const conf.wordsPerPage = 5;
// const conf.howManyPages = 1;
// const conf.rowTextLenght = 100100; //333444; //900090009;
// const conf.sentenceLenghtMin = 35;
// const conf.sentenceLenghtMax = 50;

const makeWordsList = async (conf) => {
  createFolder("mp3");
  const file = path.resolve(__dirname, conf.textSource);

  const text = fs.readFileSync(file, {
    encoding: "utf8",
  });

  const normalizedText = getText(conf, text);
  write("mp3/0normalizedText.txt", normalizedText);

  // 2 get sentences
  const sentences = getSentences(conf, normalizedText);

  // 3 get words object
  const wordsFullLength = await getWords(conf, normalizedText, sentences);

  const words = wordsFullLength.slice(0, conf.howManyPages * conf.wordsPerPage);

  // console.log(3, words);

  const wordsChunk = _.chunk(words, conf.wordsPerPage);
  // console.log(wordsChunk);

  let counter = 0;
  for (chunk of wordsChunk) {
    counter++;
    const data = {
      currentPage: counter,
      howManyPages: conf.howManyPages,
      words: chunk,
    };

    fs.writeFileSync(
      path.resolve(__dirname, "mp3", `words-${counter}.json`),
      JSON.stringify(data)
    );
  }

  // console.log("xxxxxxxxxxxxxxxxxx", words);
  return { normalizedText, words, sentences };
};

const getText = (conf, text) => {
  // console.log(text.length);
  // 1 normalize text
  let t = text.slice(0, conf.rowTextLenght);

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
  t = t.replace(/\. /g, `.${conf.splitter}`);
  t = t.replace(/\? /g, `?${conf.splitter}`);
  t = t.replace(/\! /g, `!${conf.splitter}`);

  return t;
};

const getSentences = (conf, text) => {
  const sentences = text.split(conf.splitter);

  const filteredS = sentences.filter(
    (s) =>
      s !== undefined &&
      s !== ". " &&
      s.length >= conf.sentenceLenghtMin &&
      s.length <= conf.sentenceLenghtMax
  );

  const uniq = _.uniqBy(filteredS, (item) => item);

  const orderedSentences = uniq.sort((a, b) => a.length - b.length);

  return orderedSentences;
};

const getWords = async (conf, text, sentences) => {
  let rowText = text;
  rowText = rowText.replace(new RegExp(conf.splitter, "g"), ` `);
  rowText = rowText.replace(/\:/g, ``);
  rowText = rowText.replace(/\;/g, ``);
  rowText = rowText.replace(/\./g, ``);
  rowText = rowText.replace(/\?/g, ``);
  rowText = rowText.replace(/\!/g, ``);
  rowText = rowText.replace(/\,/g, ``);

  const rowWords = rowText.split(" ");
  const wordsFiltered = rowWords.filter((w) => w.length > 1);

  const countWords = _.countBy(wordsFiltered);

  const words = await Promise.all(
    Object.entries(countWords)
      .slice(0, conf.wordsPerPage * conf.howManyPages)
      .map(async (item) => {
        const translation = await translate(conf, item[0]);
        console.log(1, item, translation);
        const word = {
          word: item[0],
          [conf.target_lang]: translation,
          count: item[1],
          examples: [],
        };

        return word;
      })
  );

  // var results = await Promise.all(
  //   words.map(async (word) => {
  //     await wait(2000);
  //     console.log("xxxxxxxxxxxxxxx");
  //     return word + 1;
  //   })
  // );

  const wordsOrdered = _.orderBy(words, ["count"], ["desc"]);

  const first1000words = wordsOrdered.slice(0, 1000).map((w) => w.word);

  const examples = createExamplesArray(sentences, first1000words);
  // console.log("examples", examples.length);

  const wordsWithExamples = wordsOrdered.map((item) => {
    const newItem = { ...item };
    // console.log(1, newItem);

    for (let i = 1; i <= conf.examplexPerWord; i++) {
      const index = examples.findIndex((example) => {
        const exampleLowerCase = example
          .toLowerCase()
          .replace(/\. /g, "")
          .replace(/\? /g, "")
          .replace(/\! /g, "");

        return exampleLowerCase.split(" ").includes(item.word.toLowerCase());
      });
      if (index !== -1) {
        const example = examples.splice(index, 1);
        newItem.examples.push({ sentence: example[0] });
      }
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
