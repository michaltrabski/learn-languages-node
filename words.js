const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs-extra");
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
  readSourceContent,
  myWriteSync,
} = require("./utils");
const path = require("path");
const axios = require("axios");
const n = require("normalize-text");
const _ = require("lodash");
const { normalizeText } = require("normalize-text");

const makeWordsList = async (conf) => {
  const { source_lang: EN, target_lang: PL } = conf;
  const file = path.resolve(__dirname, conf.textSource);

  const textFromSourceContent = readSourceContent(conf);

  const { normalizedTextInArr, normalizedText } = myNormalizedText(
    conf,
    textFromSourceContent
  );
  myWriteSync("normalizedContent", `${EN}-${PL}-text.txt`, normalizedTextInArr);

  // 2 get sentences
  const sentences = getSentences(conf, normalizedTextInArr);
  myWriteSync("normalizedContent", `${EN}-${PL}-sentences.json`, sentences);

  // 3 get words object
  const wordsFullLength = await getWords(conf, normalizedText, sentences);
  // console.log(1, wordsFullLength);

  const words = wordsFullLength.slice(0, conf.howManyPages * conf.wordsPerPage);

  // console.log(2, words);

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

    myWriteSync(
      `content/${EN}/${PL}/`,
      `content-${EN}-${PL}-${counter}.json`,
      data
    );
  }

  return { normalizedText, words, sentences };
};

const myNormalizedText = (conf, text) => {
  const { splitter } = conf;
  // console.log(text.length);
  // 1 normalize text
  let t = text.slice(0, conf.rowTextLenght);
  console.log(0, t);

  // t = normalizeText(t);

  // second step => remove caracters listed below
  t = t.replace(/\*/g, "");
  t = t.replace(/\t+/g, " "); // tab
  t = t.replace(/\]/g, "");
  t = t.replace(/\[/g, "");
  t = t.replace(/\=/g, " ");
  t = t.replace(/\"/g, "");
  t = t.replace(/\“/g, "");
  t = t.replace(/\”/g, "");
  t = t.replace(/\.\.\./g, "");
  t = t.replace(/\.\./g, "");
  t = t.replace(/\;/g, "");
  t = t.replace(/\r/g, "");

  // console.log(11111111111111);
  console.log(t);

  const normalizedTextInArr = [];
  let normalizedText = "";

  const arr = t
    .split(/\n/)
    .filter((item) => item)
    .forEach((item) => {
      item = item.replace(/\. /g, `.${conf.splitter}`);
      item = item.replace(/\? /g, `?${conf.splitter}`);
      item = item.replace(/\! /g, `!${conf.splitter}`);
      const items = item.split(splitter);
      items.forEach((i) => {
        let line = i.trim();
        line = line.replace(/\s+/g, " ");

        const first = line[0];
        const last = line[line.length - 1];

        if (
          line.length > 1 &&
          first !== first.toLowerCase() &&
          /(\.)|(\!)|(\?)/.test(last)
        ) {
          normalizedTextInArr.push(line);
          normalizedText += line + " ";
        }
      });
    });

  // console.log(44444, normalizedTextInArr);

  // third step => replace breaklines
  // t = t.replace(/\n*/g, "");

  // console.log(1, t);
  // 3 replace caracters

  // t = t.replace(/\t/g, " ");

  // console.log(2, t);
  // t = t.replace(/\s+\./g, ".");
  // t = t.replace(/\s+\?/g, "?");
  // t = t.replace(/\s+\!/g, "!");
  // // console.log(3, t);
  // t = t.replace(/\.\./g, ".");
  // t = t.replace(/\?\./g, "?");
  // t = t.replace(/\!\./g, "!");
  // // console.log(4, t);
  // t = t.replace(/\. /g, `.${conf.splitter}`);
  // t = t.replace(/\? /g, `?${conf.splitter}`);
  // t = t.replace(/\! /g, `!${conf.splitter}`);
  // console.log(5, t);
  return { normalizedTextInArr, normalizedText };
};

// const getText = (conf, text) => {
//   // console.log(text.length);
//   // 1 normalize text
//   let t = text.slice(0, conf.rowTextLenght);

//   // 2 remove caracters
//   t = t.replace(/\*/g, "");
//   t = t.replace(/\]/g, "");
//   t = t.replace(/\[/g, "");
//   t = t.replace(/\=/g, " ");
//   t = t.replace(/\"/g, "");
//   t = t.replace(/\“/g, "");
//   t = t.replace(/\”/g, "");
//   t = t.replace(/\.\.\./g, "");
//   t = t.replace(/\.\./g, "");
//   t = t.replace(/\;/g, "");

//   // console.log(1, t);
//   // 3 replace caracters
//   t = t.replace(/\n/g, ".");
//   t = t.replace(/\t/g, " ");
//   t = t.replace(/\s+/g, " ");
//   console.log(2, t);
//   t = t.replace(/\s+\./g, ".");
//   t = t.replace(/\s+\?/g, "?");
//   t = t.replace(/\s+\!/g, "!");
//   console.log(3, t);
//   t = t.replace(/\.\./g, ".");
//   t = t.replace(/\?\./g, "?");
//   t = t.replace(/\!\./g, "!");
//   console.log(4, t);
//   t = t.replace(/\. /g, `.${conf.splitter}`);
//   t = t.replace(/\? /g, `?${conf.splitter}`);
//   t = t.replace(/\! /g, `!${conf.splitter}`);
//   // console.log(5, t);
//   return t;
// };

const getSentences = (conf, arrWithSentences) => {
  const sentences = [...arrWithSentences];
  // console.log(999999, text, sentences);
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
  const wordsFiltered = rowWords.filter((w) => w.length > 1 && w / w !== 1);
  // console.log(wordsFiltered);

  const countWords = _.countBy(wordsFiltered);

  // const words = await Promise.all(
  //   Object.entries(countWords)
  //     .slice(0, conf.wordsPerPage * conf.howManyPages)
  //     .map(async (item) => {
  //       const translation = await translate(conf, item[0]);

  //       const word = {
  //         word: item[0],
  //         [conf.target_lang]: translation,
  //         count: item[1],
  //         examples: [],
  //       };

  //       return word;
  //     })
  // );

  const words = Object.entries(countWords).map((item) => ({
    word: item[0],
    count: item[1],
    examplesForWord: [],
  }));

  const wordsOrdered = _.orderBy(words, ["count"], ["desc"]).slice(
    0,
    conf.howManyPages * conf.wordsPerPage
  );

  const wordsOrderedWithTranslations = await Promise.all(
    wordsOrdered.map(async (item) => {
      const translation = await translate(conf, item.word);
      return { ...item, [conf.target_lang]: translation };
    })
  );

  // console.log(1, wordsOrderedWithTranslations);

  const first1000words = wordsOrderedWithTranslations
    .slice(0, 1000)
    .map((w) => w.word);

  const examples = createExamplesArray(sentences, first1000words);
  // console.log("examples", examples.length);

  const wordsWithExamples = await Promise.all(
    wordsOrderedWithTranslations.map(async (item) => {
      const newItem = { ...item };

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
          // wwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
          // console.log(111111111111111, example[0]);
          const translation = await translate(conf, example[0]);

          // console.log(223333333, translation);
          newItem.examplesForWord.push({
            example: example[0],
            [conf.target_lang]: translation,
          });
        }
      }

      return newItem;
    })
  );

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
